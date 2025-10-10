// ✅ app/api/admin/orders/[id]/confirm/route.ts
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { sendRaffleEmail } from "@/lib/mailer";
import { buildRaffleEmail } from "@/lib/emailTemplates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Helpers
function random4int(): number {
  return Math.floor(Math.random() * 10000); // 0..9999
}
function pad4(n: number): string {
  return n.toString().padStart(4, "0");
}

async function generateUniqueTicketsForOrder(
  supabase: any,              // aflojado para evitar conflictos de tipos
  raffle_id: string,
  count: number,
  maxAttempts = 3000
): Promise<number[]> {
  const created: number[] = [];
  let attempts = 0;

  while (created.length < count && attempts < maxAttempts) {
    attempts++;
    const num = random4int();

    // Tipado defensivo para evitar `never`
    const { error } = await (supabase as any)
      .from("tickets")
      .insert(
        [
          {
            raffle_id,
            number: num,
            status: "paid", // cumple tu CHECK
            reservation_expires_at: null,
          },
        ] as any[],
        { returning: "minimal" }
      );

    if (!error) {
      created.push(num);
    } else {
      const msg = (error.message || "").toLowerCase();
      // si no es conflicto de UNIQUE, abortar
      if (!(msg.includes("duplicate") || msg.includes("unique") || msg.includes("conflict"))) {
        console.error("❌ [ADMIN CONFIRM] error insert ticket:", error.message);
        throw error;
      }
      // si fue conflicto, seguir probando
    }
  }

  if (created.length < count) {
    throw new Error(
      `No fue posible generar todos los boletos (${created.length}/${count}). Puede que no queden combinaciones únicas.`
    );
  }
  return created;
}

export async function POST(_req: Request, context: any) {
  const id = String(context?.params?.id || "");

  // 1) Validar admin por sesión
  const cookieStore = cookies(); // ✅ síncrono en route handlers
  const supabaseUser = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser();

  if (userErr || !user || user.user_metadata?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2) Cliente admin (service role)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 3) Leer orden + rifa
  const { data: order, error: readErr } = await admin
    .from("orders")
    .select("id, raffle_id, quantity, status, boletos, correo, name")
    .eq("id", id)
    .single();

  if (readErr || !order) {
    return new Response(JSON.stringify({ error: readErr?.message || "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const qty = Number(order.quantity ?? 0);
  if (!Number.isInteger(qty) || qty <= 0) {
    return new Response(JSON.stringify({ error: "Cantidad inválida" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!order.raffle_id) {
    return new Response(JSON.stringify({ error: "Falta raffle_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4) Idempotencia: ya confirmada con boletos
  if (order.status === "confirmed" && order.boletos) {
    let tickets: string[] = [];
    try {
      tickets =
        typeof order.boletos === "string"
          ? JSON.parse(order.boletos as any)
          : ((order.boletos as any) ?? []);
    } catch {
      tickets = [];
    }
    if (Array.isArray(tickets) && tickets.length > 0) {
      return new Response(JSON.stringify({ ok: true, confirmed: true, tickets }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // si está confirmada pero sin boletos (caso raro), seguimos y los generamos
  }

  // 5) Generar boletos únicos e insertar en tickets
  const nums = await generateUniqueTicketsForOrder(admin, order.raffle_id, qty);
  const formatted = nums.map(pad4);
  const boletosPayload = JSON.stringify(formatted);

  // 6) Guardar en orders
  const { error: updErr } = await admin
    .from("orders")
    .update({ boletos: boletosPayload, status: "confirmed" })
    .eq("id", id);

  if (updErr) {
    return new Response(JSON.stringify({ error: updErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 7) Traer info de la rifa para el email (se usa en el template)
  const { data: raffle } = await admin
    .from("raffles")
    .select("title, slug, price, banner_url")
    .eq("id", order.raffle_id)
    .maybeSingle();

  // 8) Enviar correo (si hay destinatario)
  try {
    const to = order.correo || null;
    console.log("✉️ [ADMIN CONFIRM] preparando email…", {
      to,
      qty,
      tickets: formatted,
    });

    if (!to || formatted.length === 0) {
      console.warn("⚠️ [ADMIN CONFIRM] sin email o sin tickets — no se enviará.");
    } else {
      const { subject, html, text } = buildRaffleEmail({
        customerName: order.name,
        raffleTitle: raffle?.title ?? raffle?.slug ?? "Rifa",
        tickets: formatted,
        unitPriceRD: Number(raffle?.price ?? 0),
        bannerUrl: raffle?.banner_url || null,
        supportEmail: "Rifardvip@gmail.com",
      });

      const info = await sendRaffleEmail({ to, subject, text, html });
      if (info.ok) {
        console.log("📩 [ADMIN CONFIRM] Email enviado OK. id:", (info as any).id);
      } else {
        console.warn("⚠️ [ADMIN CONFIRM] fallo al enviar email:", (info as any).error);
      }
    }
  } catch (e: any) {
    console.error("❌ [ADMIN CONFIRM] fallo enviando email:", e?.message);
    // no romper la confirmación si falla email
  }

  return new Response(JSON.stringify({ ok: true, confirmed: true, tickets: formatted }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
