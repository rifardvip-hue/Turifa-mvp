// app/api/admin/bank-institutions/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  // Nota: persistSession false para uso server-side
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// PATCH /api/admin/bank-institutions/[id]
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = params?.id;

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

    const admin = getAdmin();

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

// Stub mínimo para que Next detecte el módulo incluso si PATCH no se usa en build
export async function GET() {
  return NextResponse.json({ ok: true });
}
