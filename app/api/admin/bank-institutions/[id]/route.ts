import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PATCH - Actualizar institución bancaria
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "ID requerido" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { ok: false, error: "Datos inválidos" },
        { status: 400 }
      );
    }

    console.log("📝 Actualizando institución:", id);
    console.log("📦 Datos recibidos:", body);

    // Construir objeto de actualización
    const updateData: any = {};

    if (body.name !== undefined) {
      updateData.name = (body.name || "").trim();
    }

    if (body.method !== undefined) {
      updateData.method = body.method;
    }

    if (body.account !== undefined) {
      updateData.account = body.account || null;
    }

    if (body.holder !== undefined) {
      updateData.holder = body.holder || null;
    }

    if (body.logo_url !== undefined) {
      updateData.logo_url = body.logo_url || null;
    }

    if (body.extra !== undefined) {
      updateData.extra = body.extra || null;
    }

    if (body.order !== undefined) {
      updateData.order = typeof body.order === "number" ? body.order : 0;
    }

    console.log("🔄 Actualizando con:", updateData);

    const { data, error } = await admin
      .from("bank_institutions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("❌ Error de Supabase:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    console.log("✅ Institución actualizada:", data);

    return NextResponse.json({
      ok: true,
      bank: data,
      item: data,
      message: "Institución actualizada correctamente",
    });
  } catch (e: any) {
    console.error("❌ Error en PATCH:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Error del servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar institución bancaria
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "ID requerido" },
        { status: 400 }
      );
    }

    console.log("🗑️ Eliminando institución:", id);

    const { error } = await admin
      .from("bank_institutions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("❌ Error al eliminar:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    console.log("✅ Institución eliminada");

    return NextResponse.json({
      ok: true,
      message: "Institución eliminada correctamente",
    });
  } catch (e: any) {
    console.error("❌ Error en DELETE:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Error del servidor" },
      { status: 500 }
    );
  }
}