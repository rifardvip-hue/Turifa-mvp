import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const cookieStore = await cookies();
  const supabaseUser = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabaseUser.auth.getUser();

  if (!user || user.user_metadata?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: resv, error } = await admin
    .from("reservations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !resv) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  if (resv.status === "confirmed") {
    return Response.json({ ok: true, id: resv.id, status: "confirmed" });
  }

  const { data: updated, error: updErr } = await admin
    .from("reservations")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirmed_by: user.id,
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (updErr) {
    return new Response(JSON.stringify({ error: updErr.message }), { status: 400 });
  }

  return Response.json({ ok: true, id: updated.id, status: updated.status });
}
