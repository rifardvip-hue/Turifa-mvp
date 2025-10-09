// app/api/admin/voucher-url/[reservationId]/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(_req: Request, { params }: { params: { reservationId: string } }) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== 'admin') return new Response('Unauthorized', { status: 401 });

  const { data: resv } = await supabase.from('reservations').select('voucher_url').eq('id', params.reservationId).single();
  if (!resv?.voucher_url) return new Response('Not found', { status: 404 });

  const { data, error } = await supabase.storage.from('vouchers').createSignedUrl(resv.voucher_url.replace('vouchers/', ''), 60);
  if (error) return new Response(error.message, { status: 400 });
  return Response.json({ url: data.signedUrl });
}
