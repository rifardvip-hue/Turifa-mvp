// app/rifa/list/page.tsx
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Raffle = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  price?: number | null;
  banner_url?: string | null;
  created_at?: string | null; // 👈 necesario para el badge "Nuevo"
};

async function getRaffles(): Promise<Raffle[]> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;

  const res = await fetch(`${base}/api/raffles`, { cache: "no-store" });
  const json = await res.json();
  if (!json?.ok) return [];
  return (json.items || []) as Raffle[];
}

export default async function Page() {
  const raffles = await getRaffles();

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100">
      {/* Header sticky */}
      <section className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-neutral-200 shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-4 md:py-5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-green-700">
            🎟️ Rifas activas
          </h1>
          <p className="mt-1 text-xs sm:text-sm md:text-base text-neutral-600">
            Bienvenido/a a la página oficial de rifas. Participa en sorteos exclusivos eligiendo tus{" "}
            <b>últimos 4 dígitos</b>. ¡Mucha suerte!
          </p>
        </div>
      </section>

      {/* Contenido */}
      <section className="mx-auto max-w-6xl px-3 sm:px-4 py-6 md:py-8">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] sm:text-xs font-medium text-neutral-700 bg-white shadow-sm">
            {raffles.length} {raffles.length === 1 ? "rifa disponible" : "rifas disponibles"}
          </span>
        </div>

        {raffles.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 md:p-8 text-center text-neutral-600 shadow-sm">
            Aún no hay rifas publicadas. Vuelve pronto.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {raffles.map((r, idx) => {
              const isNew =
                r.created_at &&
                Date.now() - new Date(r.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;

              return (
                <li
                  key={r.id}
                  className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
                >
                  {/* Imagen + Badge */}
                  <div className="relative aspect-[16/9] w-full">
                    <Image
                      src={r.banner_url || "/banner-raffle.jpg"}
                      alt={r.title || "Rifa"}
                      fill
                      className="object-cover"
                      unoptimized
                      priority={idx === 0}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    {isNew && (
                      <span
                        className="absolute left-3 top-3 rounded-full bg-green-600/95 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md"
                        aria-label="Rifa nueva"
                        title="Rifa nueva"
                      >
                        Nuevo
                      </span>
                    )}
                  </div>

                  {/* Texto */}
                  <div className="p-4 md:p-5">
                    <h2 className="line-clamp-1 text-base sm:text-lg md:text-xl font-semibold text-neutral-900">
                      {r.title}
                    </h2>

                    {/* Descripción visible y responsiva */}
                    <p className="mt-1 text-[12px] sm:text-sm md:text-base text-neutral-600 line-clamp-3 md:line-clamp-2">
                      {r.description || "Sin descripción."}
                    </p>

                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <span className="text-sm md:text-base text-neutral-700 text-center sm:text-left">
                        {r.price != null ? (
                          <>
                            Boleto:{" "}
                            <b className="text-green-700">
                              ${Number(r.price).toFixed(2)}
                            </b>
                          </>
                        ) : (
                          <span className="text-neutral-500">Precio no disponible</span>
                        )}
                      </span>

                      {/* Botón grande en móvil, más compacto en desktop */}
                      <Link
                        href={`/rifa/${r.slug}`}
                        className="inline-flex items-center justify-center rounded-xl bg-green-600 px-5 py-3 md:px-5 md:py-2.5 text-base md:text-sm font-semibold text-white shadow-md hover:bg-green-700 hover:shadow-lg active:translate-y-px transition-all duration-150 ease-out w-full sm:w-auto"
                        aria-label={`Participar en ${r.title}`}
                      >
                        🎫 Participar
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-8 md:mt-10 text-[11px] sm:text-xs text-neutral-500 text-center">
          💡 Tip: Al entrar a una rifa verás métodos de pago, instrucciones y cómo confirmar tus números.
        </p>
      </section>
    </main>
  );
}
