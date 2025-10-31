import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ========================================
// GET - Listar todas las rifas
// ========================================
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
    const offset = (page - 1) * pageSize;

    const { data: raffles, error, count } = await admin
      .from("raffles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      items: raffles || [],
      total: count || 0,
      page,
      pageSize,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Error interno", details: e?.message },
      { status: 500 }
    );
  }
}

// ========================================
// POST - Crear nueva rifa
// ========================================
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const newRaffle = {
      slug: body.slug || `nueva-rifa-${Date.now()}`,
      title: body.title || "Nueva Rifa",
      description: body.description || "",
      price: Number(body.price) || 0,
      total_tickets: Number(body.total_tickets) || 10000,
      status: body.status || "draft",
      banner_url: body.banner_url || null,
      bank_instructions: body.bank_instructions || null,
      media: body.media || { banner: null, gallery: [], payments: [] },
    };

    const { data, error } = await admin
      .from("raffles")
      .insert([newRaffle])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, raffle: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Error interno", details: e?.message },
      { status: 500 }
    );
  }
}