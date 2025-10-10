// app/api/orders/find-by-email/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * Busca órdenes por email (normalizado en minúsculas) para una rifa,
 * y devuelve tickets confirmados si existen.
 * Query params:
 *   - raffle: uuid de la rifa
 *   - email: email (se normaliza a lower)
 */
export async function GET(req: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const { searchParams } = new URL(req.url);
  const raffle = (searchParams.get("raffle") || "").trim();
  const emailRaw = (searchParams.get("email") || "").trim();
  if (!raffle || !emailRaw) {
    return NextResponse.json({ ok: false, error: "Faltan parámetros" }, { status: 400 });
  }

  const email = emailRaw.toLowerCase();

  // 1) Traer órdenes de esa rifa por email
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, status")
    .eq("raffle_id", raffle)
    .eq("correo", email)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json({ ok: true, found_pending: false, tickets: [] });
  }

  // 2) Si hay órdenes, buscar tickets asociados (confirmados)
  //    Ajusta los nombres de columnas si en tu tabla difieren.
  const orderIds = orders.map((o) => o.id);
  const { data: tickets, error: tErr } = await supabase
    .from("tickets")
    .select("digits, status, order_id")
    .in("order_id", orderIds);

  if (tErr) {
    return NextResponse.json({ ok: false, error: tErr.message }, { status: 400 });
  }

  const confirmed = (tickets || []).filter((t) => (t.status || "").toLowerCase() === "confirmed");
  const found_pending = orders.some((o) => (o.status || "").toLowerCase() !== "confirmed");

  return NextResponse.json({
    ok: true,
    found_pending,
    tickets: confirmed.map((t) => ({ digits: String(t.digits), verified: true })),
  });
}
