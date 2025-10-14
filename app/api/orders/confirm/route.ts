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

    const { error } = await supabase
      .from("tickets")
      .insert([
        {
          raffle_id,
          number: num,
          status: "paid",
          reservation_expires_at: null,
        },
      ]);

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

/** Escape mínimo para HTML */
function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

    // 6) Armar y enviar correo (si hay correo del cliente) — HTML con estilos inline
    if (order.correo) {
      const subject = `🎟️ Tus boletos - ${raffleTitle}`;

      const ticketsArray = formatted.map(String);
      const quantity = ticketsArray.length;
      const totalLabel = `RD$ ${totalPaid.toLocaleString("es-DO")}`;
      const raffleUrl = `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") + (raffle?.slug ? "/rifa/" + raffle.slug : "")}`;
      const voucherUrl = typeof order.voucher_url === "string" && order.voucher_url ? order.voucher_url : undefined;

      const pill = (t: string) =>
        `<span style="display:inline-block;padding:10px 14px;border-radius:999px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:700;letter-spacing:1px">${esc(
          t
        )}</span>`;
      const ticketsHtml = ticketsArray.map(pill).join("&nbsp;");

      const html = `
<!doctype html>
<html lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Tus boletos - ${esc(raffleTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="background:#0ea5e9;padding:20px 24px;color:#fff;">
          <div style="font-size:14px;opacity:.9;">Tu Rifa Hoy</div>
          <div style="font-size:20px;font-weight:800;margin-top:4px;">🎟️ Tus boletos</div>
        </td></tr>

        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 10px 0;font-size:20px;line-height:1.4;">${esc(raffleTitle)}</h1>
          <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;">
            Hola ${esc(order.name ?? "Cliente")},<br/>
            Gracias por participar en <strong>${esc(raffleTitle)}</strong>.
          </p>

          <div style="margin:16px 0;">
            <div style="font-weight:700;margin-bottom:8px;">Tus boletos:</div>
            <div>${ticketsHtml}</div>
          </div>

          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;">
            <tr><td style="padding:10px 0;border-top:1px solid #e5e7eb;">
              <div style="display:flex;justify-content:space-between;font-size:14px;">
                <span>Cantidad</span><strong>${quantity}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:14px;">
                <span>Total</span><strong>${esc(totalLabel)}</strong>
              </div>
            </td></tr>
          </table>

          ${
            raffle?.slug
              ? `<div style="margin:18px 0;">
                   <a href="${raffleUrl}" target="_blank"
                      style="display:inline-block;background:#16a34a;color:white;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:700;">
                     Ver rifa
                   </a>
                 </div>`
              : ``
          }

          ${
            voucherUrl
              ? `<p style="margin:16px 0 0 0;font-size:13px;">
                   Comprobante: <a href="${voucherUrl}" style="color:#2563eb;text-decoration:underline;" target="_blank">${voucherUrl}</a>
                 </p>`
              : ``
          }

          <p style="margin:24px 0 0 0;font-size:12px;color:#6b7280;">
            Si no realizaste esta compra, responde a este correo de inmediato.
          </p>
        </td></tr>

        <tr><td style="background:#f9fafb;padding:14px 24px;font-size:12px;color:#6b7280;">
          © ${new Date().getFullYear()} Tu Rifa Hoy. Todos los derechos reservados.
        </td></tr>
      </table>

      <div style="max-width:600px;margin-top:12px;font-size:11px;color:#6b7280;padding:0 12px;">
        Recibiste este correo porque realizaste una reserva en Tu Rifa Hoy.
      </div>
    </td></tr>
  </table>
</body>
</html>
`;

      const text = [
        `Tus boletos - ${raffleTitle}`,
        ``,
        `Hola ${order.name ?? "Cliente"},`,
        `Gracias por participar en ${raffleTitle}.`,
        ``,
        `Boletos: ${ticketsArray.join(", ")}`,
        `Cantidad: ${quantity}`,
        `Total: ${totalLabel}`,
        raffle?.slug ? `Ver rifa: ${raffleUrl}` : ``,
        voucherUrl ? `Comprobante: ${voucherUrl}` : ``,
      ].join("\n");

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
