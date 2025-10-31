// ✅ app/api/admin/orders/[id]/reject/route.ts
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_req: Request, context: any) {
  const id = String(context?.params?.id || "");
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1) Validar admin (cookies() es síncrono)
  const cookieStore = cookies();
  const supabaseUser = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser();

  if (userErr || !user || user.user_metadata?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2) Cliente admin (service role) para modificar la orden
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 3) Rechazar orden
  const { error: updErr } = await admin
    .from("orders")
    .update({ status: "rejected" })
    .eq("id", id);

  if (updErr) {
    return new Response(JSON.stringify({ error: updErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, id, status: "rejected" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
