// app/api/create-reservation/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- helpers cortos ---
function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function asInt(n: any, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(1, Math.floor(v)) : def;
}
function normalizePhone(p: string) {
  const digits = (p || "").replace(/[^\d+]/g, "");
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  return digits;
}
async function getRaffleBasics(raffle_id: string) {
  const { data, error } = await admin
    .from("raffles")
    .select("slug, price")
    .eq("id", raffle_id)
    .single();
  if (error || !data) return null;
  return { slug: String(data.slug), price: Number(data.price ?? 0) };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
    }

    const {
      raffle_id,
      nombre,
      telefono,
      correo,
      quantity,
      voucher_url,
      payment_id,
      boletos,   // opcional: array con números elegidos
      notas,     // opcional
    } = body as {
      raffle_id: string;
      nombre: string;
      telefono: string;
      correo?: string | null;
      quantity: number;
      voucher_url: string;
      payment_id?: string | null;
      boletos?: (string | number)[] | null;
      notas?: string | null;
    };

    // Validaciones mínimas
    if (!raffle_id || !isUUID(raffle_id)) {
      return NextResponse.json({ ok: false, error: "raffle_id inválido" }, { status: 400 });
    }
    if (!nombre || typeof nombre !== "string" || nombre.trim().length < 2) {
      return NextResponse.json({ ok: false, error: "Nombre requerido" }, { status: 400 });
    }
    if (!telefono || typeof telefono !== "string") {
      return NextResponse.json({ ok: false, error: "Teléfono requerido" }, { status: 400 });
    }
    if (!voucher_url || typeof voucher_url !== "string") {
      return NextResponse.json({ ok: false, error: "Comprobante (voucher_url) requerido" }, { status: 400 });
    }

    const rb = await getRaffleBasics(raffle_id);
    if (!rb) {
      return NextResponse.json({ ok: false, error: "Rifa no encontrada" }, { status: 404 });
    }

    const qty = Math.min(50, asInt(quantity, 1));
    const phone = normalizePhone(telefono);
    const email = (correo || "").trim() || null;

    // Para compatibilidad con tu UI admin, guardamos los números elegidos (si hay)
    // en 'boletos' como JSON (arreglo de strings)
    const boletosJson =
      Array.isArray(boletos) ? JSON.stringify(boletos.map(String)) : null;

    // Insert en ORDERS (lo que tu admin consume)
    const { data, error } = await admin
      .from("orders")
      .insert({
        raffle_id,
        name: nombre.trim(),
        telefono: phone,
        correo: email,
        quantity: qty,
        voucher_url,
        payment_id: payment_id || null,
        boletos: boletosJson,  // jsonb
        notas: notas ?? null,
        status: "pending_review", // como muestra tu panel
      })
      .select("id")
      .single();

    if (error) {
      console.error("INSERT orders error:", error);
      return NextResponse.json({ ok: false, error: "No se pudo crear la reserva" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id: data.id,
      status: "pending_review",
    });
  } catch (e: any) {
    console.error("create-reservation POST:", e);
    return NextResponse.json({ ok: false, error: "Error inesperado" }, { status: 500 });
  }
}
