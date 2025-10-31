import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  context: { params: { slug: string } }
) {
  try {
    const slug = context.params.slug;

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Slug requerido" },
        { status: 400 }
      );
    }

    console.log("🔍 Buscando rifa con slug:", slug);

    // 1. Buscar la rifa por slug
    const { data: raffle, error: raffleError } = await supabase
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

    // 2. Buscar las instituciones bancarias de esta rifa
    const { data: institutions, error: instError } = await supabase
      .from("bank_institutions")
      .select("*")
      .eq("raffle_id", raffle.id)
      .order("order", { ascending: true });

    if (instError) {
      console.error("⚠️ Error cargando instituciones:", instError);
      // No fallar si no hay instituciones, solo log
    }

    console.log("🏦 Instituciones encontradas:", institutions?.length || 0);

    // 3. Construir respuesta completa
    const response = {
      ok: true,
      raffle: {
        ...raffle,
        bank_institutions: institutions || [],
      },
    };

    console.log("📦 Enviando respuesta con instituciones:", response.raffle.bank_institutions);

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("❌ Error en API:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Error del servidor" },
      { status: 500 }
    );
  }
}