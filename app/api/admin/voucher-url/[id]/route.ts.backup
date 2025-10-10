// app/api/admin/voucher-url/[reservationId]/route.ts
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: Request, context: any) {
  const reservationId = String(context?.params?.reservationId || "");
  if (!reservationId) {
    return NextResponse.json({ error: "Missing reservationId" }, { status: 400 });
  }

  // cookies() es síncrono en route handlers
  const supabase = createRouteHandlerClient({ cookies: () => cookies() });
  const { data: { user } = { user: null } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Buscar voucher_url en la reserva
  const { data: resv, error } = await supabase
    .from("reservations")
    .select("voucher_url")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!resv?.voucher_url) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let url = String(resv.voucher_url);

  // Si ya es http(s) la devolvemos tal cual; si no, firmamos desde el bucket indicado
  if (!/^https?:\/\//i.test(url)) {
    // esperar formato "vouchers/archivo.png" o "bucket/path..."
    const [bucket, ...rest] = url.split("/");
    const path = rest.join("/");
    const { data: signed, error: signErr } = await supabase
      .storage.from(bucket)
      .createSignedUrl(path, 60 * 10);
    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ error: signErr?.message || "sign_failed" }, { status: 400 });
    }
    url = signed.signedUrl;
  }

  return NextResponse.json({ url });
}
