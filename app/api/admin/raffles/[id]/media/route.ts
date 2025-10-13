// app/api/admin/raffles/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cliente admin (SERVICE ROLE) → ignora RLS
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Utilidad para crear slugs
function slugify(s: string) {
  return (s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60) || `rifa-${Math.random().toString(36).slice(2, 8)}`;
}

/* ===================== GET detalle admin ===================== */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const { data: raffle, error } = await admin
    .from("raffles")
    .select(
      `
      *,
      bank_institutions (*)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !raffle) {
    return NextResponse.json({ ok: false, error: error?.message || "Rifa no encontrada" }, { status: 404 });
  }

  const { data: media } = await admin
    .from("raffle_media")
    .select("id, type, url, order")
    .eq("raffle_id", id)
    .order("order", { ascending: true });

  return NextResponse.json({
    ok: true,
    raffle: {
      ...raffle,
      banner_url: raffle.banner_url ?? raffle.media?.banner ?? null,
      media: {
        banner: raffle.banner_url ?? raffle.media?.banner ?? null,
        gallery: (media ?? []).map((m) => ({
          id: m.id,
          type: (m.type as "image" | "video") || "image",
          url: m.url,
          order: m.order ?? 0,
        })),
        // Se usa en el editor como "Instituciones guardadas (DB)"
        payments: (raffle.bank_institutions ?? []).map((b: any) => ({
          id: b.id,
          name: b.name,
          type: b.method,
          account: b.account ?? "",
          holder: b.holder ?? "",
          logo_url: b.logo_url ?? null,
          order: b.order ?? 0,
        })),
      },
    },
  });
}

/* ===================== PATCH actualizar todo (+ slug automático) ===================== */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  try {
    const body = await req.json();

    const title = String(body?.title ?? "");
    const description = String(body?.description ?? "");
    const bank_instructions = String(body?.bank_instructions ?? "");
    const price = Number.isFinite(Number(body?.price)) ? Number(body?.price) : 0;
    const total_tickets = Number.isFinite(Number(body?.total_tickets)) ? Number(body?.total_tickets) : 0;

    const banner_url = body?.banner_url ?? body?.media?.banner ?? null;
    const gallery = Array.isArray(body?.media?.gallery) ? body.media.gallery : [];
    const payments = Array.isArray(body?.media?.payments) ? body.media.payments : [];

    // Traer rifa actual para decidir tema del slug
    const { data: current, error: curErr } = await admin
      .from("raffles")
      .select("id, slug")
      .eq("id", id)
      .maybeSingle();

    if (curErr || !current) {
      return NextResponse.json({ ok: false, error: curErr?.message || "Rifa no encontrada" }, { status: 404 });
    }

    // Reglas para el slug:
    // - Si el body trae slug no vacío → lo usamos (slugify + unicidad).
    // - Si NO trae slug y el actual parece "inicial" (nueva-rifa...) → generamos desde el title.
    // - Si no aplica nada, conservamos el actual.
    let nextSlug: string | undefined = undefined;

    const bodySlugRaw = typeof body?.slug === "string" ? body.slug.trim() : "";
    if (bodySlugRaw) {
      nextSlug = slugify(bodySlugRaw);
    } else {
      const isDefaultSlug = !current.slug || current.slug.startsWith("nueva-rifa");
      if (isDefaultSlug && title) {
        nextSlug = slugify(title);
      }
    }

    // Asegurar unicidad si vamos a cambiarlo
    if (nextSlug && nextSlug !== current.slug) {
      const { data: conflict } = await admin
        .from("raffles")
        .select("id")
        .eq("slug", nextSlug)
        .maybeSingle();
      if (conflict && conflict.id !== id) {
        nextSlug = `${nextSlug}-${Math.random().toString(36).slice(2, 5)}`;
      }
    } else {
      nextSlug = undefined; // no cambiar
    }

    // 1) Update principal
    const { error: upErr } = await admin
      .from("raffles")
      .update({
        title,
        description,
        bank_instructions,
        price,
        total_tickets,
        banner_url,
        media: { banner: banner_url },
        ...(nextSlug ? { slug: nextSlug } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });

    // 2) Reemplazar galería normalizada
    await admin.from("raffle_media").delete().eq("raffle_id", id);
    if (gallery.length) {
      const rows = gallery.map((g: any, idx: number) => ({
        raffle_id: id,
        type: g.type === "video" ? "video" : "image",
        url: g.url,
        order: Number.isFinite(Number(g.order)) ? Number(g.order) : idx,
      }));
      const { error: galErr } = await admin.from("raffle_media").insert(rows as any[]);
      if (galErr) return NextResponse.json({ ok: false, error: galErr.message }, { status: 400 });
    }

    // 3) Sincronizar instituciones bancarias
    const { data: existing, error: exErr } = await admin
      .from("bank_institutions")
      .select("id")
      .eq("raffle_id", id);
    if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 400 });

    const payloadIds = new Set(
      payments.map((p: any) => String(p.id || "")).filter((v) => v && !v.startsWith("p_"))
    );
    const existingIds = new Set((existing ?? []).map((e: any) => e.id as string));
    const toDelete = [...existingIds].filter((x) => !payloadIds.has(x));
    if (toDelete.length) {
      await admin.from("bank_institutions").delete().in("id", toDelete);
    }

    const toInsert: any[] = [];
    const toUpdate: any[] = [];
    payments.forEach((p: any, idx: number) => {
      const base = {
        raffle_id: id,
        method: String(p.type || "transfer"),
        name: String(p.name || ""),
        account: p.account || null,
        holder: p.holder || null,
        logo_url: p.logo_url || null,
        order: Number.isFinite(Number(p.order)) ? Number(p.order) : idx,
      };
      const pid = String(p.id || "");
      if (!pid || pid.startsWith("p_")) toInsert.push(base);
      else toUpdate.push({ id: pid, ...base });
    });

    if (toInsert.length) {
      const { error: insErr } = await admin.from("bank_institutions").insert(toInsert as any[]);
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
    }
    for (const row of toUpdate) {
      const { id: bid, ...rest } = row;
      const { error: upbErr } = await admin.from("bank_institutions").update(rest).eq("id", bid);
      if (upbErr) return NextResponse.json({ ok: false, error: upbErr.message }, { status: 400 });
    }

    // Respuesta incluye el slug final para que el frontend sepa si cambió
    return NextResponse.json({ ok: true, slug: nextSlug ?? current.slug });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Error interno", details: err?.message }, { status: 500 });
  }
}