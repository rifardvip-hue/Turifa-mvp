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
    const { id: bankId } = await params;
    
    if (!bankId) {
      return NextResponse.json({ ok: false, error: "Falta bank id" }, { status: 400 });
    }

    const { data: bank, error: bankError } = await admin
      .from("bank_institutions")
      .select("id, raffle_id")
      .eq("id", bankId)
      .single();

    if (bankError || !bank) {
      return NextResponse.json({ ok: false, error: "Banco no encontrado" }, { status: 404 });
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

    const ext = type.split("/")[1] || "png";
    const key = `raffles/${bank.raffle_id}/banks/logo-${randomUUID()}.${ext}`;

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

    const { error: updateErr } = await admin
      .from("bank_institutions")
      .update({ logo_url: publicUrl })
      .eq("id", bankId);

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, logo_url: publicUrl });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
