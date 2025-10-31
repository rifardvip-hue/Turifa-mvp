import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Slug requerido" },
        { status: 400 }
      );
    }

    console.log("🔍 Buscando rifa con slug:", slug);

    const { data: raffle, error: raffleError } = await admin
      .from("rifas")
      .select("*")
      .eq("slug", slug)
      .single();

    if (raffleError || !raffle) {
      console.error("❌ Error buscando rifa:", raffleError);
      return NextResponse.json(
        { ok: false, error: "Rifa no encontrada" },
        { status: 404 }
      );
    }

    console.log("✅ Rifa encontrada:", raffle.id);

    const { data: institutions, error: instError } = await admin
      .from("bank_institutions")
      .select("*")
      .eq("raffle_id", raffle.id)
      .order("order", { ascending: true });

    if (instError) {
      console.error("⚠️ Error cargando instituciones:", instError);
    }

    console.log("🏦 Instituciones encontradas:", institutions?.length || 0);

    return NextResponse.json({
      ok: true,
      raffle: {
        ...raffle,
        bank_institutions: institutions || [],
      },
    });
  } catch (e: any) {
    console.error("❌ Error en API:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Error del servidor" },
      { status: 500 }
    );
  }
}