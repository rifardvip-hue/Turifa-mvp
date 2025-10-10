import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request, context: any) {
  try {
    const reservationId = String(context?.params?.id || "");
    if (!reservationId) {
      return NextResponse.json(
        { ok: false, error: "Falta reservation id" },
        { status: 400 }
      );
    }

    // Si necesitas leer cuerpo:
    // const body = await req.json(); // { motivo?: string } por ejemplo

    // Lógica para marcar como "rejected":
    const { error } = await admin
      .from("reservations")
      .update({ status: "rejected" })
      .eq("id", reservationId);

    if (error) {
      return NextResponse.json(
        { ok: false, error: `DB: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
