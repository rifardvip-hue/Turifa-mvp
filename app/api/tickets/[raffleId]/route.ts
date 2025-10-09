import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // importa tu cliente admin

export async function GET(
  req: Request,
  { params }: { params: { raffleId: string } }
) {
  const { raffleId } = params;

  try {
    // 1️⃣ Traemos todos los números ya usados/reservados/comprados de la rifa
    const { data: usedTickets, error: ordersErr } = await supabaseAdmin
      .from("orders")
      .select("numbers")
      .eq("raffle_id", raffleId);

    if (ordersErr) {
      return NextResponse.json(
        { error: ordersErr.message },
        { status: 500 }
      );
    }

    // 2️⃣ Extraemos todos los números tomados
    const taken = usedTickets?.flatMap((o: any) => o.numbers) ?? [];

    // 3️⃣ Creamos la lista de todos los boletos (puedes poner 1000 si quieres)
    const all = Array.from({ length: 100 }, (_, i) => i + 1);

    // 4️⃣ Filtramos los que aún están disponibles
    const available = all.filter((n) => !taken.includes(n));

    // 5️⃣ Devolvemos la lista de números disponibles
    return NextResponse.json({ numbers: available });
  } catch (err: any) {
    console.error("Error GET tickets:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
