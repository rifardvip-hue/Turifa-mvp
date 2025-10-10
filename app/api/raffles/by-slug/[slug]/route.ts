import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ Devuelve una rifa pública con galería, banner y bancos
export async function GET(_req: Request, context: any) {
  try {
    const slug = String(context?.params?.slug || "");
    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Falta slug" },
        { status: 400 }
      );
    }

    // 1️⃣ Buscar la rifa
    const { data: raffle, error: errRaffle } = await supabase
      .from("raffles")
      .select("id, slug, title, description, price, total_tickets, bank_instructions, banner_url")
      .eq("slug", slug)
      .single();

    if (errRaffle || !raffle) {
      return NextResponse.json(
        { ok: false, error: errRaffle?.message || "Rifa no encontrada" },
        { status: 404 }
      );
    }

    // 2️⃣ Cargar su galería desde raffle_media
    const { data: gallery, error: errGallery } = await supabase
      .from("raffle_media")
      .select("id, type, url, order")
      .eq("raffle_id", raffle.id)
      .order("order", { ascending: true });

    if (errGallery) {
      return NextResponse.json(
        { ok: false, error: errGallery.message },
        { status: 500 }
      );
    }

    // 3️⃣ Cargar bancos (si existen)
    const { data: banks } = await supabase
      .from("bank_institutions")
      .select("id, method, name, account, holder, logo_url, extra, order")
      .order("order", { ascending: true });

    // 4️⃣ Respuesta final
    return NextResponse.json({
      ok: true,
      raffle: {
        ...raffle,
        media: {
          banner: raffle.banner_url,
          gallery: gallery || [],
        },
        bank_institutions: banks || [],
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message || "Error interno" },
      { status: 500 }
    );
  }
}
