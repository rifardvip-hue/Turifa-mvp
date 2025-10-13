import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function slugify(s: string) {
  return (s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60) || `rifa-${Math.random().toString(36).slice(2, 8)}`;
}

/* GET: lista admin */
export async function GET() {
  try {
    const { data, error } = await admin
      .from("raffles")
      .select("id, slug, title, description, price, total_tickets, media, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const items = (data ?? []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      title: r.title ?? "",
      description: r.description ?? "",
      price: Number(r.price ?? 0),
      banner_url: r?.media?.banner ?? null,
      created_at: r.created_at ?? null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* POST: crea rifa SIN 'status' (columna no existe) */
export async function POST() {
  try {
    const baseTitle = "Nueva Rifa";
    let slug = slugify(baseTitle);

    // Evitar colisión de slug
    const { data: exists } = await admin.from("raffles").select("id").eq("slug", slug).maybeSingle();
    if (exists) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;

    const insertPayload = {
      slug,
      title: baseTitle,
      description: "",
      price: 0,
      total_tickets: 0,
      // JSONB por defecto; ajusta si tu columna no es json/jsonb
      media: { banner: null, gallery: [] as string[] },
      // created_at lo setea la DB si tienes default now()
    };

    const { data, error } = await admin
      .from("raffles")
      .insert(insertPayload)
      .select("id, slug")
      .single();

    if (error) throw error;
    if (!data) throw new Error("No se pudo crear la rifa");

    return NextResponse.json({ ok: true, id: data.id, slug: data.slug });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
