import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(request: Request, context: any) {
  try {
    const id = String(context?.params?.id || "");
    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta id" }, { status: 400 });
    }

    // cookies() es síncrono en route handlers
    const supabase = createRouteHandlerClient({ cookies: () => cookies() });

    // Verifica autenticación (admin)
    const { data: { session } = { session: null } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    // Body
    const body = await request.json();
    const { title, description, price, total_tickets, banner_url, slug } = body;

    // Construcción segura del update
    const updateData: Record<string, any> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (total_tickets !== undefined) updateData.total_tickets = total_tickets;
    if (banner_url !== undefined) updateData.banner_url = banner_url;
    if (slug !== undefined) updateData.slug = slug;

    const { data: raffle, error } = await supabase
      .from("raffles")
      .update(updateData)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, raffle });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// También soporta POST -> reutiliza PATCH
export async function POST(request: Request, context: any) {
  return PATCH(request, context);
}

// Maneja OPTIONS para CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
