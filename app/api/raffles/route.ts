import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error, status } = await admin
      .from("raffles")
      .select("id, slug, title, price, total_tickets, media, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("raffles list error:", status, error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const items = (data ?? []).map((r: any) => ({
      ...r,
      price: Number(r.price ?? 0),
      banner_url: r?.media?.banner ?? null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    console.error("raffles list catch:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
