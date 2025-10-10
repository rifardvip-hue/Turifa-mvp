import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/rifas/:id  -> busca por ID en la tabla "raffles"
export async function GET(_req: Request, context: any) {
  const id = String(context?.params?.id || "");
  try {
    const { data, error } = await admin
      .from("raffles")
      .select(`
        id,
        slug,
        title,
        description,
        price,
        total_tickets,
        bank_instructions,
        media,
        created_at
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message || "Not found" }, { status: 404 });
    }

    const banner = (data as any)?.media?.banner ?? null;
    const gallery = Array.isArray((data as any)?.media?.gallery) ? (data as any).media.gallery : [];

    return NextResponse.json({
      ok: true,
      raffle: {
        ...data,
        price: Number(data?.price ?? 0),
        banner_url: banner,
        media: { banner, gallery, logos: (data as any)?.media?.logos ?? null },
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
