// app/api/test-email/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sendRaffleEmail } from '@/lib/mailer';

export async function GET() {
  try {
    await sendRaffleEmail({
      to: 'TU_CORREO@gmail.com',
      subject: '🎟️ Prueba de envío automático',
      text: 'Correo de prueba enviado con Gmail + Nodemailer.',
      html: '<h2>🎟️ Envío exitoso</h2><p>Desde tu sistema de rifas.</p>',
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('❌ Error enviando correo:', e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
