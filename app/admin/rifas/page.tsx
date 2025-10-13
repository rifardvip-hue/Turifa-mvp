// app/admin/rifas/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Raffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  status?: "active" | "inactive" | string;
  banner_url?: string | null;
  created_at?: string;
};

export default function AdminRafflesPage() {
  const router = useRouter();
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Acciones en curso por rifa (para deshabilitar botones)
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const setBusy = (id: string, v: boolean) =>
    setBusyIds((prev) => ({ ...prev, [id]: v }));

  // Cargar listado
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

  // Crear rifa y redirigir a editar
  async function handleCreate() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/raffles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Nueva rifa",
          price: 0,
          description: "",
          status: "inactive",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json?.id) {
        throw new Error(json?.error || "No se pudo crear la rifa");
      }
      router.push(`/admin/rifas/${json.id}/edit`);
    } catch (e: any) {
      alert(e.message || "Error creando rifa");
      await loadRaffles();
    } finally {
      setLoading(false);
    }
  }

  // Toggle habilitar/deshabilitar
  async function handleToggleStatus(r: Raffle) {
    const next = r.status === "active" ? "inactive" : "active";
    try {
      setBusy(r.id, true);
      // Optimista
      setRaffles((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, status: next } : x))
      );

      const res = await fetch(`/api/admin/raffles/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "No se pudo actualizar el estado");
      }
    } catch (e: any) {
      alert(e.message || "Error actualizando estado");
      // Revertir
      setRaffles((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, status: r.status } : x))
      );
    } finally {
      setBusy(r.id, false);
    }
  }

  // Eliminar rifa (usa DELETE /api/admin/raffles/[id])
  async function handleDelete(r: Raffle) {
    if (!confirm(`¿Eliminar la rifa "${r.title}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      setBusy(r.id, true);
      // Optimista: quitar de la lista
      const prev = raffles;
      setRaffles((p) => p.filter((x) => x.id !== r.id));

     const res = await fetch(`/api/admin/rifas/${r.id}`, {
    method: "DELETE",
});


      // El backend puede devolver 204 (sin cuerpo) o JSON
      let ok = res.ok;
      if (res.headers.get("content-type")?.includes("application/json")) {
        const json = await res.json().catch(() => ({}));
        ok = ok && !!json?.ok;
        if (!ok) throw new Error(json?.error || "No se pudo eliminar");
      } else if (!ok) {
        // si no vino JSON y no fue ok → error genérico
        throw new Error(`Error HTTP ${res.status}`);
      }

      // Nada más que hacer: ya está fuera de la lista
    } catch (e: any) {
      alert(e.message || "Error eliminando rifa");
      // Re-cargar la lista para volver a estado real
      await loadRaffles();
    } finally {
      setBusy(r.id, false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl p-6 shadow-2xl">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black">Gestión de Rifas</h1>
              <p className="text-purple-100 mt-1">Administra tus rifas y contenido</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-2 bg-white text-purple-700 px-4 py-2 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow"
                disabled={loading}
                title="Crear nueva rifa"
              >
                <span className="text-lg">＋</span>
                <span>Nueva rifa</span>
              </button>
              <button
                onClick={() => router.push("/admin/reservations")}
                className="bg-white/10 text-white px-4 py-2 rounded-xl font-semibold hover:bg-white/20 transition-all border border-white/20"
              >
                Volver a Reservas
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center text-white py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-orange-500"></div>
            <p className="mt-4">Cargando rifas...</p>
          </div>
        )}

        {/* Error */}
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

        {/* Lista */}
        {!loading && !err && (
          <div className="grid gap-4">
            {raffles.map((raffle) => {
              const isBusy = !!busyIds[raffle.id];
              const active = raffle.status === "active";

              return (
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

                      <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                        {raffle.description || "Sin descripción."}
                      </p>

                      <div className="flex items-center gap-3 text-sm flex-wrap">
                        <span className="text-orange-400 font-semibold">
                          RD${Number.isFinite(raffle.price) ? raffle.price.toFixed(2) : "0.00"}
                        </span>
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-400">
                          Estado:{" "}
                          <span
                            className={`px-2 py-0.5 rounded border ${
                              active
                                ? "bg-green-900/30 border-green-700 text-green-300"
                                : "bg-gray-800 border-gray-700 text-gray-300"
                            }`}
                          >
                            {active ? "active" : "inactive"}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex md:flex-col gap-2 md:items-end">
                      <button
                        onClick={() => router.push(`/admin/rifas/${raffle.id}/edit`)}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg flex items-center gap-2 disabled:opacity-60"
                        disabled={isBusy}
                        title="Editar rifa"
                      >
                        ✏️ Editar
                      </button>

                      <a
                        href={`/rifa/${raffle.slug}`}
                        target="_blank"
                        className="px-5 py-2.5 rounded-xl font-semibold bg-gray-800 text-white border border-gray-700 hover:bg-gray-700 transition disabled:opacity-60"
                        aria-label="Ver pública"
                      >
                        Ver pública
                      </a>

                      <button
                        onClick={() => handleToggleStatus(raffle)}
                        className={`px-5 py-2.5 rounded-xl font-semibold transition shadow disabled:opacity-60 ${
                          active
                            ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                            : "bg-green-600 hover:bg-green-700 text-white"
                        }`}
                        disabled={isBusy}
                        title={active ? "Deshabilitar" : "Habilitar"}
                      >
                        {active ? "Deshabilitar" : "Habilitar"}
                      </button>

                      <button
                        onClick={() => handleDelete(raffle)}
                        className="px-5 py-2.5 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-700 transition shadow disabled:opacity-60"
                        disabled={isBusy}
                        title="Eliminar rifa"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {raffles.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-xl mb-2">No hay rifas disponibles</p>
                <p className="text-sm">Crea una rifa para comenzar</p>
                <div className="mt-4">
                  <button
                    onClick={handleCreate}
                    className="inline-flex items-center gap-2 bg-white text-purple-700 px-5 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow"
                  >
                    <span className="text-lg">＋</span>
                    <span>Nueva rifa</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
