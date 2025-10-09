"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Raffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  status?: string;
  banner_url?: string | null;
  created_at?: string;
};

export default function AdminRafflesPage() {
  const router = useRouter();
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadRaffles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRaffles() {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch("/api/admin/raffles", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo listar las rifas");
      }

      const items = (data.items ?? []) as any[];

      // Normalizamos para que el componente no dependa del shape exacto del backend
      const mapped: Raffle[] = items.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title ?? "",
        description: r.description ?? "",
        price: Number(r.price ?? 0),
        status: r.status ?? "active",
        banner_url: r.banner_url ?? r?.media?.banner ?? null,
        created_at: r.created_at,
      }));

      setRaffles(mapped);
    } catch (e: any) {
      setErr(e.message);
      setRaffles([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl p-6 shadow-2xl">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black">Gestión de Rifas</h1>
              <p className="text-purple-100 mt-1">Administra tus rifas y contenido</p>
            </div>
            <button
              onClick={() => router.push("/admin/reservations")}
              className="bg-white text-purple-700 px-4 py-2 rounded-xl font-semibold hover:bg-blue-50 transition-all"
            >
              Volver a Reservas
            </button>
          </div>
        </div>

        {loading && (
          <div className="text-center text-white py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-orange-500"></div>
            <p className="mt-4">Cargando rifas...</p>
          </div>
        )}

        {!loading && err && (
          <div className="text-center text-red-400 py-12">
            <p className="font-semibold">Error: {err}</p>
            <button
              onClick={loadRaffles}
              className="mt-3 px-4 py-2 rounded bg-gray-800 text-white border border-gray-600 hover:bg-gray-700"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !err && (
          <div className="grid gap-4">
            {raffles.map((raffle) => (
              <div
                key={raffle.id}
                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-gray-700 hover:border-purple-500 transition-all"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Miniatura si hay banner */}
                  {raffle.banner_url ? (
                    <img
                      src={raffle.banner_url}
                      alt=""
                      className="w-full md:w-56 h-32 object-cover rounded-xl border border-gray-700"
                    />
                  ) : (
                    <div className="w-full md:w-56 h-32 rounded-xl border border-dashed border-gray-700 flex items-center justify-center text-gray-500">
                      Sin banner
                    </div>
                  )}

                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-bold text-xl truncate">{raffle.title}</h3>
                      <span className="text-xs text-gray-400 truncate">/{raffle.slug}</span>
                    </div>

                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">{raffle.description}</p>

                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="text-orange-400 font-semibold">
                        RD${Number.isFinite(raffle.price) ? raffle.price.toFixed(2) : "0.00"}
                      </span>
                      <span className="text-gray-600">•</span>
                      <span className="text-gray-400">
                        Estado:{" "}
                        <span className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-200">
                          {raffle.status ?? "—"}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-2 md:items-end">
                    <button
                      onClick={() => router.push(`/admin/rifas/${raffle.id}/edit`)}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg flex items-center gap-2"
                    >
                      ✏️ Editar
                    </button>
                    <a
                      href={`/rifa/${raffle.slug}`}
                      target="_blank"
                      className="px-5 py-2.5 rounded-xl font-semibold bg-gray-800 text-white border border-gray-700 hover:bg-gray-700 transition"
                    >
                      Ver pública
                    </a>
                  </div>
                </div>
              </div>
            ))}

            {raffles.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-xl mb-2">No hay rifas disponibles</p>
                <p className="text-sm">Crea una rifa para comenzar</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
