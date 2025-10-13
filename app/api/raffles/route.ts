// app/api/admin/raffles/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Utilidad simple para slug
function slugify(s: string) {
  return (
    (s || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      .slice(0, 60) || `rifa-${Math.random().toString(36).slice(2, 8)}`
  );
}

/** LISTAR (admin) */
export async function GET() {
  try {
    const { data, error } = await admin
      .from("raffles")
      .select("id, slug, title, description, price, media, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const items = (data ?? []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      title: r.title ?? "",
      description: r.description ?? "",
      price: Number(r.price ?? 0),
      // si algún día agregas la columna, puedes volver a seleccionar status
      status: "inactive",
      banner_url: r?.media?.banner ?? null,
      created_at: r.created_at ?? null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

/** CREAR (admin) */
export async function POST(req: Request) {
  try {
    // body opcional: { title?, description?, price?, slug? }
    const body = await req.json().catch(() => ({}));
    const title: string = (body?.title ?? "Nueva rifa").toString();
    const description: string = (body?.description ?? "").toString();
    const price = Number.isFinite(Number(body?.price)) ? Number(body?.price) : 0;

    // Generar slug único a partir de slug|title
    let slug = slugify(body?.slug ?? title);

    // En caso de colisión, añade sufijo corto
    const { data: exists } = await admin
      .from("raffles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (exists) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;

    const insertPayload = {
      title,
      description,
      price,
      slug,
      // Estructura base para media
      media: { banner: null, gallery: [] as string[] },
      // created_at lo setea la DB si tiene default now()
    };

    const { data, error } = await admin
      .from("raffles")
      .insert(insertPayload)
      .select("id, slug")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id, slug: data?.slug });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
