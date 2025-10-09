import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// normaliza teléfonos: quita espacios, paréntesis y guiones
function normalizePhone(s: string) {
  return (s || "").replace(/[^\d+]/g, "");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raffle = (searchParams.get("raffle") || "").trim();
    const phoneRaw = (searchParams.get("phone") || "").trim();

    if (!raffle) {
      return NextResponse.json({ ok: false, error: "raffle requerido" }, { status: 400 });
    }
    if (!phoneRaw) {
      return NextResponse.json({ ok: false, error: "phone requerido" }, { status: 400 });
    }

    const phone = normalizePhone(phoneRaw);

    // Busca órdenes por teléfono en la misma rifa
    const { data: orders, error } = await admin
      .from("orders")
      .select("id, status")
      .eq("raffle_id", raffle)
      .or(`telefono.ilike.%${phoneRaw}%,telefono.ilike.%${phone}%`);

    if (error) {
      console.error("find-by-phone orders error:", error);
      return NextResponse.json({ ok: false, error: "No se pudo buscar" }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ ok: true, found_pending: false, tickets: [] });
    }

    // En esta primera versión devolvemos que hay órdenes encontradas.
    // Más adelante, si quieres, podemos enlazar con 'tickets' confirmados.
    const foundPending = orders.some(o => (o as any).status !== "confirmed");

    return NextResponse.json({
      ok: true,
      found_pending: foundPending,
      tickets: [] as { digits: string }[], // UI ya maneja el caso vacío
    });
  } catch (e) {
    console.error("find-by-phone GET error:", e);
    return NextResponse.json({ ok: false, error: "Error inesperado" }, { status: 500 });
  }
}
