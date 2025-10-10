import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ✅ Cliente admin que ignora RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  console.log("🔵 [PATCH] /api/admin/raffles/[id] — inicio");

  try {
    const { id } = await context.params;
    console.log("🆔 [PATCH] raffle_id:", id);

    // ── Body ────────────────────────────────────────────────────────────────────
    const raw = await request.text();
    console.log("📦 [PATCH] body(raw):", raw);
    let body: any;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error("❌ [PATCH] JSON.parse error:", e);
      return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
    }
    console.log("📦 [PATCH] body(parsed):", JSON.stringify(body, null, 2));

    const {
      title,
      description,
      price,
      total_tickets,
      bank_instructions,
      banner_url,
      slug,
      media,
    } = body;

    console.log("💰 [PATCH] price(raw):", price, " typeof:", typeof price);

    // ── Construcción payload UPDATE ─────────────────────────────────────────────
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = Number(price);
    if (total_tickets !== undefined) updateData.total_tickets = Number(total_tickets);
    if (bank_instructions !== undefined) updateData.bank_instructions = bank_instructions;
    if (banner_url !== undefined) updateData.banner_url = banner_url;
    if (slug !== undefined) updateData.slug = slug;
    if (media !== undefined) updateData.media = media;

    console.log("🧱 [PATCH] updateData:", JSON.stringify(updateData, null, 2));

    // ── Verificación existencia ────────────────────────────────────────────────
    const { data: existingRaffle, error: checkError } = await supabase
      .from("raffles")
      .select("id, title, price")
      .eq("id", id)
      .maybeSingle();

    if (checkError) {
      console.error("❌ [PATCH] verificar rifa:", checkError);
      return NextResponse.json({ ok: false, error: checkError.message }, { status: 400 });
    }
    if (!existingRaffle) {
      console.error("❌ [PATCH] rifa no encontrada:", id);
      return NextResponse.json({ ok: false, error: "Rifa no encontrada" }, { status: 404 });
    }

    console.log("✅ [PATCH] rifa encontrada:", existingRaffle.title, "💰 price(db):", existingRaffle.price);

    // ── UPDATE principal ───────────────────────────────────────────────────────
    console.log("💾 [PATCH] ejecutando UPDATE raffles →", JSON.stringify(updateData));
    const { data: updateResult, error: updateError } = await supabase
      .from("raffles")
      .update(updateData)
      .eq("id", id)
      .select("id, slug, title, price, banner_url")
      .maybeSingle();

    if (updateError) {
      console.error("❌ [PATCH] UPDATE raffles:", updateError);
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
    }
    console.log("✅ [PATCH] UPDATE OK:", updateResult);

  // ── Sincronizar GALERÍA ────────────────────────────────────────────────────
const galleryArray: any[] = Array.isArray(media?.gallery) ? media.gallery : [];
console.log("🖼️ [PATCH] gallery recibida (len):", galleryArray.length);

console.log("🗑️ [PATCH] borrando gallery previa para raffle_id:", id);
const { error: deleteGalleryError, count: delCountBefore } = await supabase
  .from("raffle_media")
  .delete({ count: "exact" })
  .eq("raffle_id", id);

if (deleteGalleryError) {
  console.error("❌ [PATCH] delete raffle_media:", deleteGalleryError);
} else {
  console.log("🗑️ [PATCH] delete OK, filas borradas:", delCountBefore);
}

if (galleryArray.length > 0) {
  // ⚠️ Construye filas SIN 'id' (que lo genere Postgres), normaliza type y order
  const rowsToInsert = galleryArray
    .filter((it) => it && typeof it.url === "string" && it.url.trim().length > 0)
    .map((it: any, idx: number) => ({
      // no mandes 'id'
      raffle_id: id,
      type: it.type === "video" ? "video" : "image",
      url: it.url,
      order: Number.isFinite(it.order) ? it.order : idx,
    }));

  console.log("🧾 [PATCH] rowsToInsert(len):", rowsToInsert.length);
  console.log("🧾 [PATCH] sample row:", rowsToInsert[0]);

  const { data: inserted, error: galleryError } = await supabase
    .from("raffle_media")
    .insert(rowsToInsert)
    .select("id, raffle_id, url, order");

  if (galleryError) {
    console.error("❌ [PATCH] insert raffle_media:", galleryError);
  } else {
    console.log("✅ [PATCH] insert raffle_media OK:", inserted);
  }

  // Verifica lo que quedó realmente
  const { data: afterRows, error: afterErr } = await supabase
    .from("raffle_media")
    .select("id, type, url, order", { count: "exact" })
    .eq("raffle_id", id)
    .order("order", { ascending: true });

  if (afterErr) {
    console.error("❌ [PATCH] select after insert:", afterErr);
  } else {
    console.log("🔎 [PATCH] gallery en DB ahora (count):", afterRows?.length);
    console.log("🔎 [PATCH] primeros items:", (afterRows || []).slice(0, 2));
  }
} else {
  console.log("ℹ️ [PATCH] gallery vacía — no hay inserts nuevos");
}


    // ── (Opcional) payments ────────────────────────────────────────────────────
    if (Array.isArray(media?.payments)) {
      console.log("🏦 [PATCH] payments (len):", media.payments.length);
      const paymentsToUpsert = media.payments.filter((p: any) => p.id && p.name && p.name.trim());
      if (paymentsToUpsert.length > 0) {
        const mapped = paymentsToUpsert.map((p: any) => ({
          id: p.id,
          raffle_id: id,
          method: p.type || "transfer",
          name: p.name,
          account: p.account || null,
          holder: p.holder || null,
          logo_url: p.logo_url || null,
          order: Number.isFinite(p.order) ? p.order : 0,
        }));
        console.log("🏦 [PATCH] upsert bank_institutions (len):", mapped.length);

        const { error: paymentsError } = await supabase
          .from("bank_institutions")
          .upsert(mapped, { onConflict: "id" });

        if (paymentsError) console.error("❌ [PATCH] upsert payments:", paymentsError);
        else console.log("✅ [PATCH] payments upsert OK");
      } else {
        console.log("ℹ️ [PATCH] payments vacíos — sin upsert");
      }
    } else {
      console.log("ℹ️ [PATCH] media.payments ausente o no array");
    }

    // ── Consultar y responder ──────────────────────────────────────────────────
    console.log("📥 [PATCH] consultando rifa actualizada…");
    const { data: updatedRaffle, error: selectError } = await supabase
      .from("raffles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (selectError || !updatedRaffle) {
      console.error("⚠️ [PATCH] no se pudo consultar rifa actualizada:", selectError);
      return NextResponse.json({
        ok: true,
        raffle: { id, ...updateData },
        warning: "Actualizado pero no se pudo consultar",
      });
    }

    console.log("✅ [PATCH] OK — title:", updatedRaffle.title, "💰 price:", updatedRaffle.price);
    return NextResponse.json({ ok: true, raffle: updatedRaffle });
  } catch (error: any) {
    console.error("💥 [PATCH] ERROR CRÍTICO:", error);
    return NextResponse.json(
      { ok: false, error: "Error interno", details: error?.message },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET por ID (admin)
// ──────────────────────────────────────────────────────────────────────────────
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  console.log("🔵 [GET] /api/admin/raffles/[id] — inicio");
  try {
    const { id } = await context.params;
    console.log("🆔 [GET] raffle_id:", id);

    const { data: raffle, error } = await supabase
      .from("raffles")
      .select(
        `
        *,
        bank_institutions (
          id,
          method,
          name,
          account,
          holder,
          logo_url,
          extra,
          order
        )
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !raffle) {
      console.error("❌ [GET] rifa no encontrada:", error);
      return NextResponse.json({ ok: false, error: "Rifa no encontrada" }, { status: 404 });
    }

    // Cargar galería
    const { data: mediaItems, error: mediaErr } = await supabase
      .from("raffle_media")
      .select("id, type, url, order", { count: "exact" })
      .eq("raffle_id", id)
      .order("order", { ascending: true });

    if (mediaErr) {
      console.error("❌ [GET] raffle_media:", mediaErr);
    } else {
      console.log("🔎 [GET] gallery count:", mediaItems?.length);
      console.log("🔎 [GET] sample:", (mediaItems || []).slice(0, 2));
    }

    const gallery = (mediaItems || []).map((item) => ({
      id: item.id,
      type: item.type as "image" | "video",
      url: item.url,
      order: item.order ?? 0,
    }));

    console.log("✅ [GET] rifa:", raffle.title, " | banner_url:", raffle.banner_url);

    return NextResponse.json({
      ok: true,
      raffle: {
        ...raffle,
        media: {
          banner: raffle.banner_url,
          gallery,
          logos: null,
        },
      },
    });
  } catch (error: any) {
    console.error("💥 [GET] ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "Error interno", details: error?.message },
      { status: 500 }
    );
  }
}
