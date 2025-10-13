// app/api/admin/raffles/[id]/media/route.ts
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Helper para evitar el warning de cookies()
function getSupabaseFromRoute() {
  const cookieStore = cookies();                 // ← capturamos una sola vez
  return createRouteHandlerClient({ cookies: () => cookieStore });
}

/* ===================== GET: Media (banner + galería) ===================== */
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const id = String(ctx?.params?.id || "");
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const supabase = getSupabaseFromRoute();

    const { data: raffle, error: raffleError } = await supabase
      .from("raffles")
      .select(
        `
        *,
        bank_institutions (
          id, method, name, account, holder, logo_url, extra, "order"
        )
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (raffleError || !raffle) {
      return NextResponse.json({ ok: false, error: "Rifa no encontrada" }, { status: 404 });
    }

    const { data: mediaItems } = await supabase
      .from("raffle_media")
      .select("id, type, url, order")
      .eq("raffle_id", id)
      .order("order", { ascending: true });

    const gallery = (mediaItems || []).map((m) => ({
      id: m.id,
      type: (m.type as "image" | "video") || "image",
      url: m.url,
      order: m.order ?? 0,
    }));

    return NextResponse.json({
      ok: true,
      raffle: {
        ...raffle,
        media: {
          banner: raffle.banner_url ?? raffle.media?.banner ?? null,
          gallery,
          payments: raffle.bank_institutions ?? [],
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Error interno", details: err?.message }, { status: 500 });
  }
}

/* ===================== POST: Subir archivos (galería / logos) ===================== */
export async function POST(request: Request, ctx: { params: { id: string } }) {
  try {
    const id = String(ctx?.params?.id || "");
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const supabase = getSupabaseFromRoute();

    const formData = await request.formData();
    // Acepta "file" o "files"
    const single = (formData.get("file") as File) || null;
    const many = (formData.getAll("files") as File[]).filter(Boolean);
    const files: File[] = single ? [single, ...many] : many;

    if (!files.length) {
      return NextResponse.json({ ok: false, error: "No se enviaron archivos" }, { status: 400 });
    }

    const uploaded: Array<{ id: string; type: "image" | "video"; url: string; order: number }> = [];

    for (const [idx, file] of files.entries()) {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const safe = file.name.replace(/\s+/g, "-").replace(/[^\w.-]/g, "");
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}.${ext}`;
      const path = `raffles/${id}/${name}`;

      const buf = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await supabase.storage
        .from("raffles")
        .upload(path, buf, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (upErr) continue;

      const { data: pub } = supabase.storage.from("raffles").getPublicUrl(path);
      const url = pub?.publicUrl || "";

      uploaded.push({
        id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: (file.type || "").startsWith("video/") ? "video" : "image",
        url,
        order: idx,
      });
    }

    if (!uploaded.length) {
      return NextResponse.json({ ok: false, error: "No se pudo subir ningún archivo. Revisa permisos del bucket." }, { status: 500 });
    }

    // La persistencia final de la galería se hace desde PATCH del otro endpoint;
    // aquí devolvemos URLs para que el cliente las use (p.ej. logo_url).
    return NextResponse.json({ ok: true, gallery: uploaded });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Error interno", details: err?.message }, { status: 500 });
  }
}

/* ===================== PATCH: Persistir orden/estado de galería ===================== */
export async function PATCH(request: Request, ctx: { params: { id: string } }) {
  try {
    const id = String(ctx?.params?.id || "");
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const supabase = getSupabaseFromRoute();
    const body = await request.json().catch(() => ({}));
    const gallery = Array.isArray(body?.gallery) ? body.gallery : null;

    if (gallery) {
      const { error: delErr } = await supabase.from("raffle_media").delete().eq("raffle_id", id);
      if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 });

      if (gallery.length) {
        const rows = gallery.map((g: any, i: number) => ({
          id: g.id,                                   // si envías id existente lo respeta
          raffle_id: id,
          type: g.type === "video" ? "video" : "image",
          url: g.url,
          order: Number.isFinite(g.order) ? g.order : i,
        }));
        const { error: insErr } = await supabase.from("raffle_media").insert(rows as any[]);
        if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

/* ===================== PUT: Upsert institución bancaria ===================== */
export async function PUT(request: Request, ctx: { params: { id: string } }) {
  try {
    const id = String(ctx?.params?.id || "");
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const supabase = getSupabaseFromRoute();
    const body = await request.json().catch(() => ({}));
    const bank = body?.bank;
    if (!bank) return NextResponse.json({ ok: false, error: "Falta 'bank' en body" }, { status: 400 });

    const payload = {
      id: bank.id ?? undefined, // si viene undefined → insert, si viene UUID → update
      raffle_id: id,
      method: bank.type ?? bank.method ?? "transfer",
      name: bank.name ?? "",
      account: bank.account ?? null,
      holder: bank.holder ?? null,
      logo_url: bank.logo_url ?? null,
      extra: bank.extra ?? null,
      order: Number.isFinite(bank.order) ? bank.order : 0,
    };

    const { data, error } = await supabase
      .from("bank_institutions")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ===================== DELETE: Eliminar institución ===================== */
export async function DELETE(request: Request, ctx: { params: { id: string } }) {
  try {
    const id = String(ctx?.params?.id || "");
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const supabase = getSupabaseFromRoute();
    const { searchParams } = new URL(request.url);
    const bank_id = searchParams.get("bank_id");
    if (!bank_id) return NextResponse.json({ ok: false, error: "bank_id requerido" }, { status: 400 });

    const { error } = await supabase
      .from("bank_institutions")
      .delete()
      .eq("id", bank_id)
      .eq("raffle_id", id);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
