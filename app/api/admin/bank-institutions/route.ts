import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // si tu RLS lo requiere, usa SERVICE_ROLE en server
);

// GET /api/admin/bank-institutions?raffle_id=UUID
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raffle_id = searchParams.get("raffle_id");
  if (!raffle_id) {
    return NextResponse.json({ ok: false, error: "raffle_id requerido" }, { status: 400 });
  }
  const { data, error } = await supa
    .from("bank_institutions")
    .select("id, method, name, account, holder, logo_url, extra, order")
    .eq("raffle_id", raffle_id)
    .order("order", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

// POST /api/admin/bank-institutions  (body JSON)
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.raffle_id || !body?.method || !body?.name) {
    return NextResponse.json({ ok: false, error: "Campos requeridos: raffle_id, method, name" }, { status: 400 });
  }
  const { data, error } = await supa
    .from("bank_institutions")
    .insert({
      raffle_id: body.raffle_id,
      method: body.method,   // "transfer" | "zelle" | "card"
      name: body.name,
      account: body.account ?? null,
      holder: body.holder ?? null,
      logo_url: body.logo_url ?? null,
      extra: body.extra ?? null,
      order: body.order ?? 0,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}
