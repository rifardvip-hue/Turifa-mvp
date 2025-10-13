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
// DELETE /api/admin/rifas/[id]
// Borra: media normalizada, instituciones, órdenes (si existen),
// y archivos del bucket "raffles/raffles/{id}/..."
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

    // 2) Borrar hijos conocidos (ajusta según tu esquema)
    //    No fallar si una tabla no existe; si hay FKs, borra hijos primero.
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

    // Órdenes / reservas (si tu tabla se llama distinto, cámbialo aquí)
    {
      const { error } = await admin.from("orders").delete().eq("raffle_id", id);
      if (error && !/relation .* does not exist/i.test(error.message)) {
        // omite si la tabla no existe; si existe y falla, lo reportamos
        stepErrors.push(`orders: ${error.message}`);
      }
    }

    // 3) Eliminar archivos del Storage (bucket "raffles")
    //    Ruta usada en tus subidas: raffles/${id}/<archivo>
    async function deleteFolderRecursive(prefix: string) {
      // Listar nivel actual
      const { data: list, error: listErr } = await admin
        .storage
        .from("raffles")
        .list(prefix, { limit: 1000 });

      if (listErr || !list) return;

      const files: string[] = [];
      const folders: string[] = [];

      for (const entry of list) {
        if (entry.name && entry.id && !entry.metadata) {
          // archivo
          files.push(`${prefix}/${entry.name}`.replace(/^\/+/, ""));
        } else if (entry.name && entry.id === null) {
          // carpeta (en supabase-js v2: id null suele indicar folder)
          folders.push(`${prefix}/${entry.name}`.replace(/^\/+/, ""));
        }
      }

      if (files.length) {
        await admin.storage.from("raffles").remove(files);
      }

      // bajar por subcarpetas
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

    // 5) Devolver resultado (incluye slug borrado por si quieres registrar algo en UI)
    return NextResponse.json({ ok: true, deleted_id: id, slug: raffle.slug });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Error interno", details: e?.message },
      { status: 500 }
    );
  }
}