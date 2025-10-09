// app/api/admin/orders/[id]/reject/route.ts
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  // 1) Validar admin
  const cookieStore = await cookies();
  const supabaseUser = createRouteHandlerClient({ cookies: () => cookieStore });
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

  // 2) Service role para actualizar
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 3) Motivo opcional
  let note = "";
  try {
    const body = await req.json().catch(() => ({}));
    note = (body?.note ?? "").toString().slice(0, 500);
  } catch {}

  // 4) Rechazar
  const { data: updated, error: updErr } = await admin
    .from("orders")
    .update({ status: "rejected", notas: note || null })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (updErr) {
    return new Response(JSON.stringify({ error: updErr.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!updated) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: updated.id, status: updated.status }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
