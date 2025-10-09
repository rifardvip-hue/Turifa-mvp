// lib/emailTemplates.ts

type BuildEmailArgs = {
  customerName?: string | null;
  raffleTitle: string;
  tickets: string[];           // ["1234","5678"...]
  unitPriceRD: number;         // 2000, etc.
  bannerUrl?: string | null;   // opcional
  supportEmail?: string;       // "Rifardvip@gmail.com"
};

function ticketHTML(d: string) {
  return `
  <div style="
    display:inline-block;
    padding:12px 16px;
    margin:6px;
    border-radius:12px;
    background:linear-gradient(135deg,#ff7a59,#ffaf7b);
    color:#fff;
    font-weight:700;
    font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    box-shadow:0 6px 14px rgba(255,122,89,.25);
    letter-spacing:1px;
  ">
    🎟️ ${d}
  </div>`;
}

/**
 * Export **con nombre**. NO uses default export aquí.
 */
export function buildRaffleEmail({
  customerName,
  raffleTitle,
  tickets,
  unitPriceRD,
  bannerUrl,
  supportEmail = "Rifardvip@gmail.com",
}: BuildEmailArgs) {
  const subject = `🎟️ Tus boletos – ${raffleTitle}`;

  const plainList = tickets.join(" ");
  const text =
    `¡Gracias por tu compra${customerName ? ", " + customerName : ""}!\n\n` +
    `Rifa: ${raffleTitle}\n` +
    `Cantidad: ${tickets.length}\n` +
    `Boletos: ${plainList}\n\n` +
    `Precio unitario: RD$${unitPriceRD.toFixed(2)}\n` +
    `Soporte: ${supportEmail}\n` +
    `— Tu Rifa Hoy`;

  const ticketsHTML = tickets.map(ticketHTML).join("");

  const html = `
  <div style="background:#0b0b0f;padding:0;margin:0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0f;color:#e5e7eb">
      <tr>
        <td align="center" style="padding:24px">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:#111827;border-radius:16px;overflow:hidden;border:1px solid #1f2937">
            <!-- Header -->
            <tr>
              <td style="padding:20px 24px;background:linear-gradient(90deg,#7c3aed,#ec4899)">
                <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:.3px;font-family:system-ui,-apple-system,Segoe UI,Roboto">Tu Rifa Hoy</div>
                <div style="color:#ffeef9;opacity:.9;margin-top:4px">Tus boletos – ${raffleTitle}</div>
              </td>
            </tr>

            <!-- Banner -->
            ${
              bannerUrl
                ? `<tr><td>
                    <img src="${bannerUrl}" alt="${raffleTitle}" style="display:block;width:100%;max-height:280px;object-fit:cover"/>
                  </td></tr>`
                : ""
            }

            <!-- Body -->
            <tr>
              <td style="padding:28px 24px 8px 24px;font-family:system-ui,-apple-system,Segoe UI,Roboto">
                <h1 style="margin:0 0 10px 0;color:#fff;font-size:22px">¡Gracias por tu compra${customerName ? ", " + customerName : ""}!</h1>
                <p style="margin:0 0 12px 0;color:#cbd5e1;font-size:14px;line-height:1.6">
                  A continuación te dejamos el detalle de tu participación.
                </p>

                <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:16px;margin:16px 0">
                  <div style="display:flex;gap:10px;color:#93c5fd;margin-bottom:6px">
                    <span>🎰</span><b>${raffleTitle}</b>
                  </div>
                  <div style="display:flex;gap:10px;color:#a7f3d0;margin-bottom:6px">
                    <span>🎫</span><b>${tickets.length}</b> boletos
                  </div>
                  <div style="display:flex;gap:10px;color:#fde68a">
                    <span>💵</span>Precio unitario: <b>RD$${unitPriceRD.toFixed(2)}</b>
                  </div>
                </div>

                <div style="margin-top:12px;color:#9ca3af;font-size:13px">Tus boletos:</div>
                <div style="margin:8px 0 6px 0">
                  ${ticketsHTML}
                </div>

                <hr style="border:0;height:1px;background:#1f2937;margin:24px 0"/>

                <p style="margin:0;color:#9ca3af;font-size:12px">
                  ¿Dudas o soporte? Escríbenos: 
                  <a href="mailto:${supportEmail}" style="color:#60a5fa;text-decoration:none">${supportEmail}</a>
                </p>
                <p style="margin:12px 0 0 0;color:#6b7280;font-size:12px">— Tu Rifa Hoy</p>
              </td>
            </tr>
          </table>

          <div style="color:#4b5563;font-size:11px;margin-top:10px;font-family:system-ui,-apple-system,Segoe UI,Roboto">
            Recibiste este correo porque realizaste una compra en Tu Rifa Hoy.
          </div>
        </td>
      </tr>
    </table>
  </div>`;

  return { subject, text, html };
}
