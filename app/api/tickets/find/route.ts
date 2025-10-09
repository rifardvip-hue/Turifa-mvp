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
  const raffleId = (searchParams.get("raffle") || "").trim(); // uuid opcional
  const slug = (searchParams.get("slug") || "").trim();       // slug opcional

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
    // Resolver ID por slug si es necesario
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

    // Caso A: búsqueda por 4 dígitos → SÍ se pueden revelar números si existen
    if (digits) {
      const { data, error } = await supabase
        .from("v_raffle_tickets") // debe representar solo tickets CONFIRMADOS
        .select("order_id, digits, telefono, correo, name, created_at")
        .eq("raffle_id", resolvedRaffleId)
        .eq("digits", digits)
        .limit(50);

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        by: "digits",
        reveals_digits: true,
        rows: data ?? [],
      });
    }

    // Caso B: búsqueda por contacto (NUNCA revelar dígitos en la respuesta)
    const ors: string[] = [];
    if (phone) ors.push(`telefono.ilike.%${phone}%`);
    if (email) {
      if (isEmail(email)) ors.push(`correo.ilike.${email}`);
      else ors.push(`correo.ilike.%${email}%`);
    }

    // ¿Hay tickets CONFIRMADOS (pero no revelaremos los números)?
    const { count: confirmedCount, error: cErr } = await supabase
      .from("v_raffle_tickets")
      .select("order_id", { head: true, count: "exact" })
      .eq("raffle_id", resolvedRaffleId)
      .or(ors.join(","));

    if (cErr) throw cErr;

    // Si no hay confirmados, revisar si hay órdenes pendientes para avisar
    let hasPending = false;
    if (!confirmedCount || confirmedCount === 0) {
      const orsOrders: string[] = [];
      if (phone) orsOrders.push(`telefono.ilike.%${phone}%`);
      if (email) orsOrders.push(`lower(correo).eq.${email.toLowerCase()}`);

      if (orsOrders.length > 0) {
        const { count: pCount, error: pErr } = await supabase
          .from("orders")
          .select("id", { head: true, count: "exact" })
          .eq("raffle_id", resolvedRaffleId)
          .or(orsOrders.join(","))
          .in("status", ["pending", "pending_review"]);

        if (pErr) throw pErr;
        hasPending = (pCount ?? 0) > 0;
      }
    }

    // Respuesta para contacto: nunca devolvemos números (rows vacíos)
    return NextResponse.json({
      ok: true,
      by: "contact",
      reveals_digits: false,
      pending: !confirmedCount && hasPending ? true : false,
      rows: [], // ← nunca números por contacto
    });
  } catch (err: any) {
    console.error("❌ [tickets/find] error:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "unknown" },
      { status: 500 }
    );
  }
}
