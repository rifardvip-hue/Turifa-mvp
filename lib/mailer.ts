// lib/mailer.ts
import 'server-only';
import nodemailer from "nodemailer";

/**
 * Envía un correo usando Gmail (requiere App Password y 2FA activado).
 * Usa las variables GMAIL_SENDER y GMAIL_APP_PASSWORD del .env.local
 */
export async function sendRaffleEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  try {
    // Configuración del transporte
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_SENDER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Enviar correo
    const info = await transporter.sendMail({
      from: `"Tu Rifa Hoy" <${process.env.GMAIL_SENDER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("📩 Email enviado con éxito:", info.messageId);
    return { ok: true, id: info.messageId };
  } catch (error: any) {
    console.error("❌ Error al enviar correo:", error);
    return { ok: false, error: error.message };
  }
}
