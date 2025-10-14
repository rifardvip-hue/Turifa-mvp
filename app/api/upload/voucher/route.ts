// app/api/upload/voucher/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = "vouchers";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    let payment_id = (form.get("payment_id") as string) || uuidv4();

    if (!file) {
      return NextResponse.json({ ok: false, error: "MISSING_FILE" }, { status: 400 });
    }

    // Convertir File a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`📤 Archivo recibido: ${file.name}, Tamaño: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);

    // Comprimir imagen con Sharp (SUPER RÁPIDO)
    let processedBuffer: Buffer;
    
    if (file.type.startsWith("image/")) {
      try {
        // Comprimir y redimensionar
        processedBuffer = await sharp(buffer)
          .resize(1200, 1200, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toBuffer();

        console.log(`✅ Imagen comprimida: ${(processedBuffer.length / 1024 / 1024).toFixed(2)}MB (${((1 - processedBuffer.length / buffer.length) * 100).toFixed(0)}% reducción)`);
      } catch (sharpErr) {
        console.warn("⚠️ Error comprimiendo, usando original:", sharpErr);
        processedBuffer = buffer;
      }
    } else {
      // Si no es imagen, usar archivo original
      processedBuffer = buffer;
    }

    // Subir a Supabase Storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const filepath = `vouchers/${payment_id}.jpg`; // Siempre guardar como JPG

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filepath, processedBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filepath);

    return NextResponse.json({ ok: true, url: pub.publicUrl, payment_id });
  } catch (err: any) {
    console.error("UPLOAD_ERROR:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "UPLOAD_ERROR" },
      { status: 500 }
    );
  }
}