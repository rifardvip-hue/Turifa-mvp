import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// POST /api/upload/voucher/media
// Body (multipart/form-data):
//   - file (File)  ó  voucher (File)
// Devuelve: { ok: true, url: string }
export async function POST(req: Request) {
  try {
    // ✅ crear cookieStore y supabase correctamente (una sola vez)
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const form = await req.formData();
    const file = (form.get("file") || form.get("voucher")) as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "Falta archivo 'file' o 'voucher'" },
        { status: 400 }
      );
    }

    const mime = (file.type || "").toLowerCase() || "image/jpeg";
    if (!mime.startsWith("image/")) {
      return NextResponse.json(
        { ok: false, error: "El archivo debe ser una imagen" },
        { status: 415 }
      );
    }

    // 🧩 nombre seguro + ruta dentro del bucket "vouchers"
    const originalBase =
      file.name.split(".").slice(0, -1).join(".") || "voucher";
    const safeBase = originalBase.replace(/\s+/g, "-").replace(/[^\w.-]/g, "");
    const ext = mime.split("/")[1] || "jpg";
    const objectPath = `uploads/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}-${safeBase}.${ext}`;

    const bytes = new Uint8Array(await file.arrayBuffer());

    // ✅ sube al bucket "vouchers" usando la ruta relativa (sin duplicar el nombre del bucket)
    const { error: upErr } = await supabase.storage
      .from("vouchers")
      .upload(objectPath, bytes, {
        contentType: mime,
        upsert: false,
      });

    if (upErr) {
      return NextResponse.json(
        { ok: false, error: `Storage: ${upErr.message}` },
        { status: 500 }
      );
    }

    // ✅ URL pública del mismo objeto subido
    const { data } = supabase.storage
      .from("vouchers")
      .getPublicUrl(objectPath);
    const url = data?.publicUrl;

    if (!url) {
      return NextResponse.json(
        { ok: false, error: "No se pudo generar URL pública" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error interno" },
      { status: 500 }
    );
  }
}
