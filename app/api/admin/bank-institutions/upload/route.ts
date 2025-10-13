import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // usa SERVICE_ROLE para permisos de escritura en storage
);

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "Falta archivo" }, { status: 400 });
    }

    // Subir archivo al bucket “public”
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `bank-logos/${randomUUID()}.${ext}`;

    const { data, error: uploadError } = await admin.storage
      .from("public")
      .upload(filename, file, { contentType: file.type });

    if (uploadError) {
      console.error(uploadError);
      return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${data.path}`;
    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (e: any) {
    console.error("upload error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
