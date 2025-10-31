// app/rifas/page.tsx
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

type Raffle = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price: number | null;
  banner_url: string | null;
};

async function getRaffles(): Promise<Raffle[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  // Ajusta el .from y columnas a tu esquema real.
  const { data, error } = await supabase
    .from("raffles")
    .select("id, slug, title, description, price, banner_url")
    .order("id", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Supabase error:", error);
    return [];
  }
  return (data ?? []) as Raffle[];
}

export default async function RifasPage() {
  const raffles = await getRaffles();

  return (
    <main className="min-h-screen bg-[#f9f9f9] py-12 px-4">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">🎟️ Rifas activas</h1>
            <p className="text-sm text-gray-600">
              Elige una rifa para participar con tus últimos 4 dígitos.
            </p>
          </div>
          {/* espacio para filtro/buscador en el futuro */}
        </header>

        {raffles.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center text-gray-600">
            Aún no hay rifas publicadas.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {raffles.map((r) => (
              <li
                key={r.id}
                className="overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="relative h-44 w-full">
                  <Image
                    src={r.banner_url || "/banner-raffle.jpg"}
                    alt={r.title || "Rifa"}
                    fill
                    className="object-cover"
                    // evita configurar domains de next/image por ahora
                    unoptimized
                    priority={false}
                  />
                </div>

                <div className="space-y-2 p-4">
                  <h2 className="line-clamp-1 text-lg font-semibold">{r.title}</h2>
                  {r.price != null && (
                    <p className="text-sm text-gray-700">Boleto: <b>${Number(r.price).toFixed(2)}</b></p>
                  )}
                  <p className="line-clamp-2 text-sm text-gray-500">
                    {r.description ?? "Sin descripción"}
                  </p>

                  <div className="pt-2">
                    <Link
                      href={`/rifa/${r.slug}`}
                      className="inline-flex w-full items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Participar
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
