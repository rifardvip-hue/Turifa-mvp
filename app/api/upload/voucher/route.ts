// app/api/upload/voucher/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const maxDuration = 30; // 30 segundos máximo

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = "vouchers";

// Máximo 3MB
const MAX_FILE_SIZE = 3 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    let payment_id = (form.get("payment_id") as string) || uuidv4();

    if (!file) {
      return NextResponse.json({ ok: false, error: "MISSING_FILE" }, { status: 400 });
    }

    // Rechazar archivos muy grandes
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        ok: false, 
        error: `El archivo es muy grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Por favor usa una imagen de máximo 3MB.` 
      }, { status: 400 });
    }

    console.log(`📤 Archivo: ${file.name}, Tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const ext = file.name?.split(".").pop()?.toLowerCase() || "jpg";
    const filepath = `vouchers/${payment_id}.${ext}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filepath, file, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

    if (upErr) {
      console.error("Supabase upload error:", upErr);
      throw upErr;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filepath);

    console.log(`✅ Upload exitoso: ${filepath}`);

    return NextResponse.json({ ok: true, url: pub.publicUrl, payment_id });
  } catch (err: any) {
    console.error("UPLOAD_ERROR:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al subir el archivo" },
      { status: 500 }
    );
  }
}