import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "raffles";

/* =========================================================
   POST - Subir archivos a la galería (guarda storage_key)
   ========================================================= */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: raffleId } = await params;
    if (!raffleId) {
      return NextResponse.json({ ok: false, error: "Falta raffle id" }, { status: 400 });
    }

    const form = await req.formData();
    const files = form.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ ok: false, error: "No se enviaron archivos" }, { status: 400 });
    }

    const uploaded: Array<{ type: "image" | "video"; url: string; storage_key: string }> = [];

    for (const file of files) {
      const type = (file.type || "").toLowerCase();
      const isImage = type.startsWith("image/");
      const isVideo = type.startsWith("video/");
      if (!isImage && !isVideo) continue;

      const ext = type.split("/")[1] || (isImage ? "jpg" : "mp4");
      const key = `raffles/${raffleId}/gallery-${randomUUID()}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(key, arrayBuffer, { contentType: type, upsert: false });

      if (upErr) {
        console.error(`Error subiendo ${file.name}:`, upErr);
        continue;
      }

      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(key);
      const publicUrl = pub?.publicUrl;

      if (publicUrl) {
        uploaded.push({
          type: isVideo ? "video" : "image",
          url: publicUrl,
          storage_key: key, // <<--- guardamos la clave para poder borrar en Storage
        });
      }
    }

    if (uploaded.length === 0) {
      return NextResponse.json({ ok: false, error: "No se pudo subir ningún archivo" }, { status: 500 });
    }

    // Obtener el siguiente "order"
    const { data: existing } = await admin
      .from("raffle_media")
      .select("order")
      .eq("raffle_id", raffleId)
      .order("order", { ascending: false })
      .limit(1);

    let nextOrder = (existing?.[0]?.order ?? -1) + 1;

    // Insertar en la tabla raffle_media
    const rows = uploaded.map((item) => ({
      raffle_id: raffleId,
      type: item.type,
      url: item.url,
      storage_key: item.storage_key, // <<---
      order: nextOrder++,
    }));

    const { error: insertErr } = await admin.from("raffle_media").insert(rows);
    if (insertErr) {
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    // Retornar la galería completa actualizada
    const { data: allMedia } = await admin
      .from("raffle_media")
      .select("id, type, url, order, storage_key")
      .eq("raffle_id", raffleId)
      .order("order", { ascending: true });

    const gallery = (allMedia ?? []).map((m) => ({
      id: m.id,
      type: m.type as "image" | "video",
      url: m.url,
      order: m.order ?? 0,
      storage_key: m.storage_key ?? null,
    }));

    return NextResponse.json({ ok: true, gallery });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

/* =========================================================
   PUT - Actualizar institución bancaria (se mantiene igual)
   ========================================================= */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: raffleId } = await params;
    if (!raffleId) {
      return NextResponse.json({ ok: false, error: "Falta raffle id" }, { status: 400 });
    }

    const body = await req.json();
    const bank = body?.bank;

    if (!bank || !bank.id) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }

    const updateData = {
      method: bank.type || "transfer",
      name: bank.name || "",
      account: bank.account || null,
      holder: bank.holder || null,
      logo_url: bank.logo_url || null,
      order: typeof bank.order === "number" ? bank.order : 0,
    };

    const { error } = await admin
      .from("bank_institutions")
      .update(updateData)
      .eq("id", bank.id)
      .eq("raffle_id", raffleId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

/* ======================================================================
   DELETE - Modo dual:
   - ?media_id=UUID  => borra elemento de GALERÍA (Storage + DB)
   - ?bank_id=UUID   => borra INSTITUCIÓN BANCARIA (se mantiene tu flujo)
   ====================================================================== */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: raffleId } = await params;
    if (!raffleId) {
      return NextResponse.json({ ok: false, error: "Falta raffle id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const mediaId = url.searchParams.get("media_id");
    const bankId  = url.searchParams.get("bank_id");

    // --- Rama 1: borrar MEDIA ---
    if (mediaId) {
      // 1) Traer registro para obtener storage_key/url
      const { data: media, error: selErr } = await admin
        .from("raffle_media")
        .select("id, storage_key, url")
        .eq("id", mediaId)
        .eq("raffle_id", raffleId)
        .single();

      if (selErr || !media) {
        return NextResponse.json({ ok: false, error: "Media no encontrada" }, { status: 404 });
      }

      // 2) Borrar archivo del Storage si tenemos clave
      let storageKey = media.storage_key as string | null;
      if (!storageKey && media.url) storageKey = keyFromPublicUrl(media.url);

      if (storageKey) {
        const { error: rmErr } = await admin.storage.from(BUCKET).remove([storageKey]);
        if (rmErr) console.error("Storage remove error:", rmErr);
      }

      // 3) Borrar fila en raffle_media
      const { error: delErr } = await admin
        .from("raffle_media")
        .delete()
        .eq("id", mediaId)
        .eq("raffle_id", raffleId);

      if (delErr) {
        return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
      }

      // 4) Devolver galería actualizada
      const { data: allMedia } = await admin
        .from("raffle_media")
        .select("id, type, url, order, storage_key")
        .eq("raffle_id", raffleId)
        .order("order", { ascending: true });

      return NextResponse.json({ ok: true, gallery: allMedia ?? [] });
    }

    // --- Rama 2: borrar BANK (tu comportamiento anterior) ---
    if (bankId) {
      const { error } = await admin
        .from("bank_institutions")
        .delete()
        .eq("id", bankId)
        .eq("raffle_id", raffleId);

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true });
    }

    // Si no llegó ningún query param válido:
    return NextResponse.json({ ok: false, error: "Falta media_id o bank_id" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

/* =========================================================================
   Helper: derivar storage_key desde la URL pública cuando falte en la fila
   ========================================================================= */
function keyFromPublicUrl(publicUrl: string): string | null {
  try {
    // Ejemplo URL:
    // https://<project>.supabase.co/storage/v1/object/public/raffles/raffles/<raffleId>/gallery-xxx.jpg
    const u = new URL(publicUrl);
    const marker = "/object/public/";
    const i = u.pathname.indexOf(marker);
    if (i === -1) return null;

    const after = u.pathname.substring(i + marker.length); // "raffles/raffles/<raffleId>/gallery-.."
    const parts = after.split("/");
    const bucket = parts.shift(); // "raffles"
    if (!bucket) return null;

    return parts.join("/"); // "raffles/<raffleId>/gallery-xxx.jpg"
  } catch {
    return null;
  }
}
