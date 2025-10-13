import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PATCH /api/admin/bank-institutions/[id]
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = params.id;

    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta el ID" }, { status: 400 });
    }

    const fields = {
      name: body.name ?? undefined,
      method: body.method ?? undefined,
      account: body.account ?? undefined,
      holder: body.holder ?? undefined,
      logo_url: body.logo_url ?? undefined,
      extra: body.extra ?? undefined,
      order: body.order ?? undefined,
    };

    const { data, error } = await admin
      .from("bank_institutions")
      .update(fields)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("❌ Error actualizando institución:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    console.error("❌ Excepción en PATCH /bank-institutions/[id]:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Error del servidor" }, { status: 500 });
  }
}
export async function GET() {
  return NextResponse.json({ ok: true });
}
