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
    const supabase = createRouteHandlerClient({ cookies: () => cookies() });

    // (Opcional) si necesitas exigir sesión:
    // const { data: { session } } = await supabase.auth.getSession();
    // if (!session) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

    const form = await req.formData();
    const file = (form.get("file") || form.get("voucher")) as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "Falta archivo 'file' o 'voucher'" }, { status: 400 });
    }
    if (!file.type?.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "El archivo debe ser una imagen" }, { status: 415 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeBase = file.name.replace(/\s+/g, "-").replace(/[^\w.-]/g, "");
    const path = `vouchers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase}.${ext}`;

    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from("vouchers")
      .upload(path.replace(/^vouchers\//, ""), bytes, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (upErr) {
      return NextResponse.json({ ok: false, error: `Storage: ${upErr.message}` }, { status: 500 });
    }

    const { data } = supabase.storage.from("vouchers").getPublicUrl(path.replace(/^vouchers\//, ""));
    const url = data?.publicUrl;

    if (!url) {
      return NextResponse.json({ ok: false, error: "No se pudo generar URL pública" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error interno" }, { status: 500 });
  }
}
