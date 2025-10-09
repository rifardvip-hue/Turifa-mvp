import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> } // 👈 params es Promise
) {
  try {
    // ✅ await params
    const { slug } = await context.params;

    // ✅ cliente admin para evitar RLS en lectura pública
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: raffle, error } = await supabase
      .from("raffles")
      .select(`
        *,
        bank_institutions (
          id,
          method,
          name,
          account,
          holder,
          logo_url,
          extra,
          order
        )
      `)
      .eq("slug", slug)
      .single();

    if (error || !raffle) {
      console.error("[BY-SLUG] no encontrada:", error);
      return new Response(JSON.stringify({ ok: false, error: "Rifa no encontrada" }), { status: 404 });
    }

    console.log("[BY-SLUG] slug=", slug, "DB price=", raffle.price, "id=", raffle.id);

    // Galería
    const { data: mediaItems, error: mediaError } = await supabase
      .from("raffle_media")
      .select("id, type, url, order")
      .eq("raffle_id", raffle.id)
      .order("order", { ascending: true });

    if (mediaError) console.error("❌ Galería error:", mediaError);
    console.log("✅ Galería rows:", (mediaItems ?? []).length, (mediaItems ?? []).slice(0, 2));

    const gallery = (mediaItems || []).map((item) => ({
      id: item.id,
      type: item.type as "image" | "video",
      url: item.url,
      order: item.order ?? 0,
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        raffle: {
          ...raffle,
          media: {
            banner: raffle.banner_url,
            gallery,
            logos: null,
          },
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Error en /api/rifas/by-slug:", error);
    return new Response(JSON.stringify({ ok: false, error: "Error interno" }), { status: 500 });
  }
}
