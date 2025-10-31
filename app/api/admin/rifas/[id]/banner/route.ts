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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: raffleId } = await params;
    
    if (!raffleId) {
      return NextResponse.json({ ok: false, error: "Falta raffle id" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "Falta archivo" }, { status: 400 });
    }

    const type = (file.type || "").toLowerCase();
    if (!type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "El archivo debe ser una imagen" }, { status: 415 });
    }

    const ext = type.split("/")[1] || "jpg";
    const key = `raffles/${raffleId}/banner-${randomUUID()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(key, arrayBuffer, { contentType: type, upsert: false });

    if (upErr) {
      return NextResponse.json({ ok: false, error: `Storage: ${upErr.message}` }, { status: 500 });
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(key);
    const publicUrl = pub?.publicUrl;

    if (!publicUrl) {
      return NextResponse.json({ ok: false, error: "No se pudo generar URL pública" }, { status: 500 });
    }

    // Actualizar banner en la tabla raffles
    const { error: updateErr } = await admin
      .from("raffles")
      .update({ banner_url: publicUrl })
      .eq("id", raffleId);

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, banner_url: publicUrl });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error inesperado" }, { status: 500 });
  }
}