import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raffle = url.searchParams.get("raffle");
  const digits = (url.searchParams.get("digits") || "").trim();

  if (!raffle || !digits) {
    return NextResponse.json(
      { ok: false, error: "Parámetros inválidos" },
      { status: 400 }
    );
  }

  // Buscar en la tabla tickets
  const { data, error } = await admin
    .from("tickets")
    .select("digits, verified, order_id")
    .eq("raffle_id", raffle)
    .eq("digits", digits)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error buscando ticket:", error);
    return NextResponse.json(
      { ok: false, error: "Error buscando ticket" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ ok: true, found: false });
  }

  return NextResponse.json({
    ok: true,
    found: true,
    verified: !!data.verified,
    order_id: data.order_id,
    ticket: data,
  });
}
