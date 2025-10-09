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

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const raffleId = params.id;
    if (!raffleId) {
      return NextResponse.json(
        { ok: false, error: "Falta raffle id" },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { ok: false, error: "Falta archivo" },
        { status: 400 }
      );
    }

    // 1️⃣ Validar tipo
    const type = (file.type || "").toLowerCase();
    if (!type.startsWith("image/")) {
      return NextResponse.json(
        { ok: false, error: "El archivo debe ser una imagen" },
        { status: 415 }
      );
    }

    // 2️⃣ Generar nombre único
    const ext = type.split("/")[1] || "jpg";
    const key = `raffles/${raffleId}/banner-${randomUUID()}.${ext}`;

    // 3️⃣ Subir a Storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(key, arrayBuffer, { contentType: type, upsert: false });

    if (upErr) {
      return NextResponse.json(
        { ok: false, error: `Storage: ${upErr.message}` },
        { status: 500 }
      );
    }

    // 4️⃣ URL pública
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(key);
    const publicUrl = pub?.publicUrl;
    if (!publicUrl) {
      return NextResponse.json(
        { ok: false, error: "No se pudo generar URL pública" },
        { status: 500 }
      );
    }

    // 5️⃣ Reemplazar banner anterior
    const { error: trxError } = await admin.rpc("replace_banner_for_raffle", {
      raffle_id_param: raffleId,
      banner_url_param: publicUrl,
    });

    if (trxError) {
      return NextResponse.json(
        { ok: false, error: `RPC: ${trxError.message}` },
        { status: 500 }
      );
    }

    // 6️⃣ Actualizar banner_url también en raffles
    await admin
      .from("raffles")
      .update({ banner_url: publicUrl })
      .eq("id", raffleId);

    // 7️⃣ Respuesta final
    return NextResponse.json({
      ok: true,
      banner_url: publicUrl,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
