import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let note = "";
  try { note = (await req.json())?.note || ""; } catch {}

  const { data, error } = await supabase
    .from("reservations")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejected_by: user.id,
      reject_note: note,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  return Response.json({ ok: true, id: data.id, status: data.status });
}
