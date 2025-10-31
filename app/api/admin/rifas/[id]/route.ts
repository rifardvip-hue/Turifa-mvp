import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cliente admin (SERVICE ROLE) → ignora RLS y NO usa cookies()
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─────────────────────────────────────────────
// GET /api/admin/rifas/[id]
// Obtener una rifa por ID
// ─────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  try {
    const { data: raffle, error } = await admin
      .from("raffles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !raffle) {
      return NextResponse.json(
        { ok: false, error: "Rifa no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, raffle });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Error interno", details: e?.message },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// PATCH /api/admin/rifas/[id]
// Actualizar una rifa
// ─────────────────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  try {
    const body = await req.json();

    // Preparar el payload de actualización
    const updateData: any = {};
    
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.price !== undefined) updateData.price = Number(body.price);
    if (body.total_tickets !== undefined) updateData.total_tickets = Number(body.total_tickets);
    if (body.status !== undefined) updateData.status = body.status;
    if (body.banner_url !== undefined) updateData.banner_url = body.banner_url;
    if (body.bank_instructions !== undefined) updateData.bank_instructions = body.bank_instructions;
    if (body.media !== undefined) updateData.media = body.media;

    const { data, error } = await admin
      .from("raffles")
      .update(updateData)
      .eq("id", id)
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

// ─────────────────────────────────────────────
// DELETE /api/admin/rifas/[id]
// Borra: media normalizada, instituciones, órdenes (si existen),
// y archivos del bucket "raffles/raffles/{id}/..."
// ─────────────────────────────────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  try {
    // 1) Comprobar que exista
    const { data: raffle, error: getErr } = await admin
      .from("raffles")
      .select("id, slug, banner_url")
      .eq("id", id)
      .maybeSingle();

    if (getErr || !raffle) {
      return NextResponse.json(
        { ok: false, error: "Rifa no encontrada" },
        { status: 404 }
      );
    }

    // 2) Borrar hijos conocidos
    const stepErrors: string[] = [];

    // Galería normalizada
    {
      const { error } = await admin.from("raffle_media").delete().eq("raffle_id", id);
      if (error) stepErrors.push(`raffle_media: ${error.message}`);
    }

    // Instituciones bancarias
    {
      const { error } = await admin.from("bank_institutions").delete().eq("raffle_id", id);
      if (error) stepErrors.push(`bank_institutions: ${error.message}`);
    }

    // Órdenes / reservas
    {
      const { error } = await admin.from("orders").delete().eq("raffle_id", id);
      if (error && !/relation .* does not exist/i.test(error.message)) {
        stepErrors.push(`orders: ${error.message}`);
      }
    }

    // 3) Eliminar archivos del Storage
    async function deleteFolderRecursive(prefix: string) {
      const { data: list, error: listErr } = await admin
        .storage
        .from("raffles")
        .list(prefix, { limit: 1000 });

      if (listErr || !list) return;

      const files: string[] = [];
      const folders: string[] = [];

      for (const entry of list) {
        if (entry.name && entry.id && !entry.metadata) {
          files.push(`${prefix}/${entry.name}`.replace(/^\/+/, ""));
        } else if (entry.name && entry.id === null) {
          folders.push(`${prefix}/${entry.name}`.replace(/^\/+/, ""));
        }
      }

      if (files.length) {
        await admin.storage.from("raffles").remove(files);
      }

      for (const f of folders) {
        await deleteFolderRecursive(f);
      }
    }

    await deleteFolderRecursive(`raffles/${id}`);

    // 4) Borrar la rifa
    const { error: delErr } = await admin.from("raffles").delete().eq("id", id);
    if (delErr) {
      return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 });
    }

    // 5) Devolver resultado
    return NextResponse.json({ ok: true, deleted_id: id, slug: raffle.slug });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Error interno", details: e?.message },
      { status: 500 }
    );
  }
}