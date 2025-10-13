// app/api/tickets/find/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function sanitizeDigits(d: string) {
  const only = (d || "").replace(/\D/g, "").slice(0, 4);
  return only.padStart(4, "0");
}
function sanitizePhone(p: string) {
  return (p || "").replace(/\D/g, "");
}
function isEmail(x: string) {
  return /\S+@\S+\.\S+/.test(x);
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const { searchParams } = new URL(req.url);
  const raffleId = (searchParams.get("raffle") || "").trim();
  const slug     = (searchParams.get("slug")    || "").trim();

  const digitsRaw = (searchParams.get("digits") || "").trim();
  const phoneRaw  = (searchParams.get("phone")  || "").trim();
  const emailRaw  = (searchParams.get("email")  || "").trim();

  const digits = digitsRaw ? sanitizeDigits(digitsRaw) : "";
  const phone  = phoneRaw ? sanitizePhone(phoneRaw) : "";
  const email  = emailRaw.toLowerCase();

  if (!raffleId && !slug) {
    return NextResponse.json(
      { ok: false, error: "Debes proveer raffle=<uuid> o slug=<string>" },
      { status: 400 }
    );
  }
  if (!digits && !phone && !email) {
    return NextResponse.json(
      { ok: false, error: "Proporciona al menos uno: digits, phone o email" },
      { status: 400 }
    );
  }

  try {
    // Resolver ID por slug si aplica
    let resolvedRaffleId = raffleId;
    if (!resolvedRaffleId && slug) {
      const { data: r, error: rErr } = await supabase
        .from("raffles")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (rErr || !r) {
        return NextResponse.json(
          { ok: false, error: "Rifa no encontrada por slug" },
          { status: 404 }
        );
      }
      resolvedRaffleId = r.id;
    }

    // A) Búsqueda por 4 dígitos (confirmados; podemos revelar)
    if (digits) {
      const { data, error } = await supabase
        .from("v_raffle_tickets") // vista: solo confirmados
        .select("order_id, digits, telefono, correo, name, created_at")
        .eq("raffle_id", resolvedRaffleId)
        .eq("digits", digits)
        .limit(50);

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        by: "digits",
        reveals_digits: true,
        has_orders: (data?.length ?? 0) > 0,
        pending: false,
        rows: data ?? [],
      });
    }

    // B) Búsqueda por contacto (correo/teléfono)
    // Si hay confirmados, TAMBIÉN revelamos los números.
    const ors: string[] = [];
    if (phone) ors.push(`telefono.ilike.%${phone}%`);
    if (email) {
      if (isEmail(email)) ors.push(`correo.ilike.${email}`);   // exacto (case-insensitive)
      else ors.push(`correo.ilike.%${email}%`);                // parcial
    }

    // 1) Traer filas confirmadas por contacto (de la vista)
    let confirmedRows: any[] = [];
    {
      const qbC = supabase
        .from("v_raffle_tickets")
        .select("order_id, digits, telefono, correo, name, created_at")
        .eq("raffle_id", resolvedRaffleId);

      if (ors.length) qbC.or(ors.join(","));
      const { data, error } = await qbC;
      if (error) throw error;
      confirmedRows = data ?? [];
    }

    if (confirmedRows.length > 0) {
      // ✔ Confirmados encontrados por contacto → revelar dígitos
      return NextResponse.json({
        ok: true,
        by: "contact",
        reveals_digits: true,
        has_orders: true,
        pending: false,
        rows: confirmedRows,
      });
    }

    // 2) ¿Existen órdenes pendientes?
    let pendingCount = 0;
    {
      const orsOrders: string[] = [];
      if (phone) orsOrders.push(`telefono.ilike.%${phone}%`);
      if (email) orsOrders.push(`correo.ilike.${email}`);

      if (orsOrders.length) {
        const qb2 = supabase
          .from("orders")
          .select("id", { head: true, count: "exact" })
          .eq("raffle_id", resolvedRaffleId)
          .in("status", ["pending", "pending_review"]);

        qb2.or(orsOrders.join(","));
        const { count, error } = await qb2;
        if (error) throw error;
        pendingCount = count ?? 0;
      }
    }

    // 3) ¿Existe cualquier orden (cualquier estado)?
    let anyCount = 0;
    {
      const orsAny: string[] = [];
      if (phone) orsAny.push(`telefono.ilike.%${phone}%`);
      if (email) orsAny.push(`correo.ilike.${email}`);

      if (orsAny.length) {
        const qb3 = supabase
          .from("orders")
          .select("id", { head: true, count: "exact" })
          .eq("raffle_id", resolvedRaffleId);

        qb3.or(orsAny.join(","));
        const { count, error } = await qb3;
        if (error) throw error;
        anyCount = count ?? 0;
      }
    }

    // Respuesta sin confirmados
    return NextResponse.json({
      ok: true,
      by: "contact",
      reveals_digits: false,
      has_orders: anyCount > 0,
      pending: pendingCount > 0, // hay órdenes pero no confirmadas
      rows: [],
    });
  } catch (err: any) {
    console.error("❌ [tickets/find] error:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "unknown" },
      { status: 500 }
    );
  }
}
