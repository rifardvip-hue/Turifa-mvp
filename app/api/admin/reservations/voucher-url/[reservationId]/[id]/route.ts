// app/api/admin/voucher-url/[id]/route.ts
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> } // Next 15: params async
) {
  const { id } = await ctx.params;

  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // guard: solo admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // buscamos en orders (ajusta si tu tabla es otra)
  const { data, error } = await supabase
    .from("orders")
    .select("voucher_url")
    .eq("id", id)
    .maybeSingle();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  if (!data?.voucher_url) {
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
  }

  // Si guardas rutas de Storage (ej: "vouchers/abc.png"), firma la URL aquí.
  // Si ya guardas un https público en voucher_url, solo devuélvelo.
  let url = data.voucher_url as string;

  // Intento de firmar si parece una ruta de storage sin https
  if (!/^https?:\/\//i.test(url)) {
    // asume bucket 'vouchers' y path en voucher_url
    const [bucket, ...rest] = url.split("/");
    const path = rest.join("/");
    const { data: signed, error: signErr } = await supabase
      .storage.from(bucket)
      .createSignedUrl(path, 60 * 10); // 10 min

    if (!signErr && signed?.signedUrl) url = signed.signedUrl;
  }

  return Response.json({ url });
}
