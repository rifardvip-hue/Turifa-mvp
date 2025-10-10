import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_req: Request, context: any) {
  const id = String(context?.params?.id || "");
  if (!id) {
    return NextResponse.json({ error: "Missing reservation id" }, { status: 400 });
  }

  // cookies() es síncrono en route handlers
  const cookieStore = cookies();
  const supabaseUser = createRouteHandlerClient({ cookies: () => cookieStore });

  const { data: { user } = { user: null } } = await supabaseUser.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (resv.status === "confirmed") {
    return NextResponse.json({ ok: true, id: resv.id, status: "confirmed" });
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
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: updated!.id, status: updated!.status });
}
