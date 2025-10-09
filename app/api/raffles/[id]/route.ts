import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, key);

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    const { data, error, status, statusText } = await admin
      .from("raffles")
      .select("id, slug, title, description, price, total_tickets, bank_instructions, media, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, where: "select", debug: { id, status, statusText }, error: error.message },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json(
        { ok: false, where: "not_found", debug: { id } },
        { status: 404 }
      );
    }

    const banner_url = (data as any)?.media?.banner ?? null;
    return NextResponse.json({
      ok: true,
      raffle: {
        ...data,
        price: Number(data?.price ?? 0),
        banner_url,
        media: {
          banner: banner_url,
          gallery: Array.isArray((data as any)?.media?.gallery) ? (data as any).media.gallery : [],
        },
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, where: "handler", debug: { id }, error: e?.message ?? "unknown" },
      { status: 500 }
    );
  }
}
