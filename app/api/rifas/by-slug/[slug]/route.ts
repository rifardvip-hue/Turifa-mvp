// app/api/rifas/by-slug/[[slug]]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs"; // ← importante si usas Node APIs

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request, context: any) {
  try {
    // En [[slug]] el parámetro puede venir undefined
    const raw = context?.params?.slug;
    const slug = typeof raw === "string" ? raw : "";

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Slug requerido" },
        { status: 400 }
      );
    }

    // 1) Buscar rifa por slug
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

    // 2) Instituciones bancarias de esa rifa
    const { data: institutions, error: instError } = await supabase
      .from("bank_institutions")
      .select("*")
      .eq("raffle_id", raffle.id)
      .order("order", { ascending: true });

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
