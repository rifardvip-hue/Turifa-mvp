// app/api/rifas/by-slug/[slug]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Service Role en server
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params?.slug || "";
    if (!slug) {
      return NextResponse.json({ ok: false, error: "slug requerido" }, { status: 400 });
    }

    // Ajusta nombres de columnas/tablas si difieren
    const { data: raffle, error } = await supabase
      .from("raffles")
      .select(`
        id,
        slug,
        title,
        description,
        price,
        bank_instructions,
        banner_url,
        raffle_media:raffle_media (
          id, type, url, order
        ),
        bank_institutions:bank_institutions (
          id, method, name, account, holder, logo_url, extra, "order"
        )
      `)
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!raffle) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const gallery = (raffle.raffle_media || []).map((m: any) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      order: m.order ?? 0,
    }));

    const payload = {
      id: raffle.id,
      slug: raffle.slug,
      title: raffle.title,
      description: raffle.description,
      price: Number(raffle.price ?? 0),
      bank_instructions: raffle.bank_instructions ?? null,
      banner_url: raffle.banner_url ?? null,
      media: {
        banner: raffle.banner_url ?? null,
        gallery,
        logos: null,
      },
      bank_institutions: raffle.bank_institutions ?? [],
    };

    return NextResponse.json(
      { ok: true, raffle: payload },
      {
        headers: {
          "Cache-Control": "no-store",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 500 });
  }
}
