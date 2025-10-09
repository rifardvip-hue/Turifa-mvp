// app/api/orders/confirm/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendRaffleEmail } from "@/lib/mailer";

/** Supabase admin (service role) */
function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** entero 0..9999 */
function random4int(): number {
  return Math.floor(Math.random() * 10000);
}

/** "0000".."9999" */
function pad4(n: number): string {
  return n.toString().padStart(4, "0");
}

/**
 * Inserta boletos únicos por rifa.
 * Reintenta si choca con el UNIQUE (raffle_id, number).
 */
async function generateUniqueTicketsForOrder(
  supabase: ReturnType<typeof getAdmin>,
  raffle_id: string,
  count: number,
  maxAttempts = 3000
): Promise<number[]> {
  const created: number[] = [];
  let attempts = 0;

  while (created.length < count && attempts < maxAttempts) {
    attempts++;
    const num = random4int();

    const { error } = await supabase.from("tickets").insert(
      [
        {
          raffle_id,
          number: num,
          status: "paid", // cumple con CHECK ('free','reserved','paid','expired')
          reservation_expires_at: null,
        },
      ],
      { returning: "minimal" }
    );

    if (!error) {
      created.push(num);
    } else {
      const msg = (error.message || "").toLowerCase();
      if (!(msg.includes("duplicate") || msg.includes("unique") || msg.includes("conflict"))) {
        console.error("Error al insertar ticket:", error.message);
        throw error;
      }
    }
  }

  if (created.length < count) {
    throw new Error(
      `No se pudo generar todos los boletos (${created.length}/${count}). Puede que ya no queden combinaciones únicas.`
    );
  }
  return created;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getAdmin();
    const body = await req.json().catch(() => ({}));
    const order_id = String(body?.order_id || "").trim();

    if (!order_id) {
      return NextResponse.json({ ok: false, error: "order_id es requerido" }, { status: 400 });
    }

    // 1) Traer la orden (incluye datos para email e idempotencia)
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, raffle_id, quantity, status, boletos, name, correo, telefono, voucher_url")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      console.error("Error al obtener orden:", orderErr?.message);
      return NextResponse.json({ ok: false, error: "Orden no encontrada" }, { status: 404 });
    }

    const qty = Number(order.quantity ?? 0);
    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ ok: false, error: "Cantidad inválida" }, { status: 400 });
    }
    if (!order.raffle_id) {
      return NextResponse.json({ ok: false, error: "Falta raffle_id" }, { status: 400 });
    }

    // 2) Idempotencia: si ya está confirmada y tiene boletos, devolvemos y NO reenviamos correo
    if (order.status === "confirmed" && order.boletos) {
      try {
        const parsed = Array.isArray(order.boletos)
          ? (order.boletos as string[])
          : typeof order.boletos === "string"
          ? (JSON.parse(order.boletos) as string[])
          : [];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return NextResponse.json({ ok: true, confirmed: true, tickets: parsed }, { status: 200 });
        }
      } catch {
        // si no parsea, seguimos y regeneramos (raro)
      }
    }

    // 3) Generar boletos únicos
    const nums = await generateUniqueTicketsForOrder(supabase, order.raffle_id, qty);
    const formatted = nums.map(pad4);

    // 4) Guardar en orders (jsonb) y marcar confirmado
    //    ⚠️ 'boletos' es jsonb → pasamos el array JS directamente (NO stringify)
    const { error: updErr } = await supabase
      .from("orders")
      .update({ boletos: formatted, status: "confirmed" })
      .eq("id", order_id);

    if (updErr) {
      console.error("Error al actualizar orden:", updErr.message);
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    // 5) Obtener info de la rifa para el asunto del correo
    const { data: raffle } = await supabase
      .from("raffles")
      .select("title, price, slug")
      .eq("id", order.raffle_id)
      .maybeSingle();

    const raffleTitle = raffle?.title ?? "Tu Rifa";
    const unitPrice = Number(raffle?.price ?? 0);
    const totalPaid = unitPrice * qty;

    // 6) Armar y enviar correo (si hay correo del cliente)
    if (order.correo) {
      const subject = `🎟️ Tus boletos - ${raffleTitle}`;
      const lines = formatted.map((c) => `• ${c}`).join("\n");
      const text = `Hola ${order.name ?? "Cliente"},

Gracias por participar en "${raffleTitle}".
Aquí están tus boletos:

${lines}

Cantidad: ${qty}
Total: RD$ ${totalPaid.toLocaleString("es-DO")}

${raffle?.slug ? `Ver rifa: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/rifa/${raffle.slug}` : ""}
${order.voucher_url ? `Comprobante: ${order.voucher_url}` : ""}

¡Éxitos!
`;

      const html = `
<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height:1.5">
  <p>Hola ${order.name ?? "Cliente"},</p>
  <p>Gracias por participar en <b>${raffleTitle}</b>.</p>
  <p>Aquí están tus boletos:</p>
  <ul>${formatted.map((c) => `<li><strong>${c}</strong></li>`).join("")}</ul>
  <p><b>Cantidad:</b> ${qty}<br/>
     <b>Total:</b> RD$ ${totalPaid.toLocaleString("es-DO")}</p>
  ${
    raffle?.slug
      ? `<p><a href="${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") + "/rifa/" + raffle.slug}">Ver rifa</a></p>`
      : ""
  }
  ${order.voucher_url ? `<p>Comprobante: <a href="${order.voucher_url}">${order.voucher_url}</a></p>` : ""}
  <p>¡Éxitos!</p>
</div>`;

      const res = await sendRaffleEmail({
        to: order.correo,
        subject,
        text,
        html,
      });

      if (!res.ok) {
        console.error("⚠️ Correo falló (no bloquea confirmación):", res.error);
      }
    } else {
      console.warn("⚠️ Orden sin correo — no se envió email:", order.id);
    }

    return NextResponse.json({ ok: true, confirmed: true, tickets: formatted }, { status: 200 });
  } catch (e: any) {
    console.error("Error interno:", e?.message);
    return NextResponse.json({ ok: false, error: e?.message || "Error interno" }, { status: 500 });
  }
}
