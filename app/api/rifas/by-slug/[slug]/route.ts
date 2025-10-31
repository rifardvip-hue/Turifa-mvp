import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Para carpeta [[slug]] el parámetro es opcional: slug?: string
export async function GET(
  req: Request,
  { params }: { params: { slug?: string } }
) {
  try {
    const slug = params.slug ?? "";

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Slug requerido" },
        { status: 400 }
      );
    }

    // 1) Rifa por slug
    const { data: raffle, error: raffleError } = await supabase
      .from("rifas")
      .select("*")
      .eq("slug", slug)
      .single();

    if (raffleError || !raffle) {
      return NextResponse.json(
        { ok: false, error: "Rifa no encontrada" },
        { status: 404 }
      );
    }

    // 2) Instituciones bancarias asociadas
    const { data: institutions, error: instError } = await supabase
      .from("bank_institutions")
      .select("*")
      .eq("raffle_id", raffle.id)
      .order("order", { ascending: true });

    // No romper si falla esta parte; solo continuar con arreglo vacío
    const bank_institutions = instError ? [] : (institutions ?? []);

    // 3) Respuesta
    return NextResponse.json(
      {
        ok: true,
        raffle: {
          ...raffle,
          bank_institutions,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Error del servidor" },
      { status: 500 }
    );
  }
}
