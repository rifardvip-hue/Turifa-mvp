import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: Request, context: any) {
  const raffleId = String(context?.params?.raffleId || "");
  if (!raffleId) {
    return NextResponse.json({ error: "Missing raffleId" }, { status: 400 });
  }

  try {
    // 1) Traer números ya usados/reservados/comprados
    const { data: usedTickets, error } = await supabaseAdmin
      .from("orders")
      .select("numbers")
      .eq("raffle_id", raffleId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2) Aplanar todos los números tomados
    const taken = (usedTickets ?? []).flatMap((o: any) => o?.numbers ?? []);

    // 3) Generar universo total (ajusta si tu rifa tiene otro total)
    const TOTAL = 100;
    const all = Array.from({ length: TOTAL }, (_, i) => i + 1);

    // 4) Filtrar disponibles
    const available = all.filter((n) => !taken.includes(n));

    return NextResponse.json({ numbers: available });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Error interno del servidor", details: e?.message },
      { status: 500 }
    );
  }
}
