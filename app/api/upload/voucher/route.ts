// app/api/upload/voucher/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const ext = file.name?.split(".").pop()?.toLowerCase() || "bin";
    const filepath = `vouchers/${payment_id}.${ext}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filepath, file, {
      contentType: file.type || "application/octet-stream",
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
