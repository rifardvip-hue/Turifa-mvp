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
    // ✅ Forma correcta: obtener cookieStore y pasarlo como closure
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const form = await req.formData();
    const file = (form.get("file") || form.get("voucher")) as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "Falta archivo 'file' o 'voucher'" },
        { status: 400 }
      );
    }
    if (!file.type?.toLowerCase().startsWith("image/")) {
      return NextResponse.json(
        { ok: false, error: "El archivo debe ser una imagen" },
        { status: 415 }
      );
    }

    // construimos ruta segura dentro del bucket "vouchers"
    const orig = file.name || "voucher.jpg";
    const ext = orig.includes(".") ? orig.split(".").pop()!.toLowerCase() : "jpg";
    const base = orig.replace(/\s+/g, "-").replace(/[^\w.-]/g, "");
    const filePath = `vouchers/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}-${base}.${ext}`;

    const bytes = new Uint8Array(await file.arrayBuffer());

    // ✅ En Supabase Storage: el filePath NO debe repetir el nombre del bucket
    const storageKey = filePath.replace(/^vouchers\//, "");

    const { error: upErr } = await supabase.storage
      .from("vouchers")
      .upload(storageKey, bytes, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (upErr) {
      return NextResponse.json(
        { ok: false, error: `Storage: ${upErr.message}` },
        { status: 500 }
      );
    }

    const { data } = supabase.storage.from("vouchers").getPublicUrl(storageKey);
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
