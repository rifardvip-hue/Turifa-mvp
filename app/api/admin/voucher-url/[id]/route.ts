// app/api/admin/voucher-url/[id]/route.ts
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // Next 15: params es async
) {
  const { id } = await ctx.params;

  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // guard admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // 1) buscar la orden y su voucher_url
  const { data, error } = await supabase
    .from("orders")
    .select("voucher_url")
    .eq("id", id)
    .maybeSingle();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  if (!data?.voucher_url) return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });

  let url = String(data.voucher_url);

  // 2) si es una ruta de storage (no http), firmar URL
  if (!/^https?:\/\//i.test(url)) {
    // ejemplo: "vouchers/archivo.png" -> bucket "vouchers", path "archivo.png"
    const [bucket, ...rest] = url.split("/");
    const path = rest.join("/");
    const { data: signed, error: signErr } = await supabase
      .storage.from(bucket)
      .createSignedUrl(path, 60 * 10); // 10 min
    if (signErr || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: signErr?.message || "sign_failed" }), { status: 400 });
    }
    url = signed.signedUrl;
  }

  return Response.json({ url });
}
