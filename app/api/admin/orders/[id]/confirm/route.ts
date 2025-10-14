// ✅ app/api/admin/orders/[id]/confirm/route.ts
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { sendRaffleEmail } from "@/lib/mailer";
import { buildRaffleEmail } from "@/lib/emailTemplates";

export const runtime = "nodejs";         // ← asegura envío HTML
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_req: Request, context: any) {
  const id = String(context?.params?.id || "");

  // 1) Validar admin por sesión (usar cookies awaited)
  const cookieStore = cookies();
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

  // 3) Leer orden + rifa básica
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

  // 4) Idempotencia: ya confirmada con boletos → devolverlos
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
    // si está confirmada pero sin boletos (caso raro), continuamos para reestablecerlos
  }

  // 5) Confirmar TODO en una sola transacción vía RPC
  const { data: rpc, error: rpcErr } = await admin.rpc("confirm_order_tx", {
    p_order_id: id,
  });

  if (rpcErr) {
    return new Response(JSON.stringify({ error: rpcErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // El RPC devuelve { ok: true, confirmed: true, tickets: [...] }
  const formatted: string[] = Array.isArray((rpc as any)?.tickets)
    ? (rpc as any).tickets
    : (() => {
        try {
          return JSON.parse((rpc as any)?.tickets ?? "[]");
        } catch {
          return [];
        }
      })();

  if (!formatted.length) {
    return new Response(JSON.stringify({ error: "La transacción no devolvió boletos" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 6) Traer info de la rifa para el email (se usa en el template)
  const { data: raffle } = await admin
    .from("raffles")
    .select("title, slug, price, banner_url")
    .eq("id", order.raffle_id)
    .maybeSingle();

  // 7) Enviar correo (si hay destinatario)
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
