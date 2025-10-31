// app/api/admin/reservations/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * Lista “reservas” pero desde la tabla orders, uniendo con raffles
 * para obtener slug y price. Calcula amount_cents = price * quantity.
 */
export async function GET(req: Request) {
const cookieStore = cookies();
const supabase = createRouteHandlerClient({ cookies });
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const status = (searchParams.get("status") || "").trim(); // "", "pending_review", "confirmed", "rejected"
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

  // Base query: orders + join a raffles (slug, price)
  // Nota: el alias `raffles:raffle_id` funciona con la FK raffle_id -> raffles.id
  let query = supabase
    .from("orders")
    .select(
      `
      id,
      raffle_id,
      name,
      correo,
      telefono,
      quantity,
      status,
      voucher_url,
      boletos,
      created_at,
      raffles:raffle_id (
        slug,
        price
      )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  // Filtro por status si viene uno válido
  const noFilter =
    status === "" ||
    status.toLowerCase() === "all" ||
    status.toLowerCase() === "todos";
  if (!noFilter) {
    query = query.eq("status", status);
  }

  // Búsqueda simple por nombre / correo / teléfono
  if (q) {
    query = query.or(
      `name.ilike.%${q}%,correo.ilike.%${q}%,telefono.ilike.%${q}%`
    );
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Adaptamos shape a la UI actual
  const rows =
    (data || []).map((r: any) => {
      const price = Number(r?.raffles?.price ?? 0); // numeric llega como string => Number()
      const qty = Number(r?.quantity ?? 0);
      const amount_cents = Math.round(price * 100 * qty);

      return {
        id: r.id as string,
        raffle_slug: r?.raffles?.slug ?? "",
        customer_name: r.name as string,
        customer_email: (r.correo ?? null) as string | null,
        customer_phone: (r.telefono ?? null) as string | null,
        amount_cents,
        status: (r.status ?? "pending_review") as
          | "pending"
          | "confirmed"
          | "rejected"
          | "pending_review",
        voucher_url: r.voucher_url ?? null,
        ticket_blocks: r.boletos, // tu jsonb de boletos
        created_at: r.created_at as string,
        // opcional: podrías enviar quantity si quieres mostrarlo en el modal
        quantity: qty,
        price, // RD$
      };
    }) ?? [];

  return NextResponse.json({
    rows,
    total: count ?? 0,
    page,
    pageSize,
  });
}
