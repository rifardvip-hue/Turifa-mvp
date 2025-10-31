// app/admin/rifas/page.tsx
"use client";

import { useEffect, useState, Fragment } from "react";
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

  // acciones en curso por rifa (para deshabilitar botones)
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const setBusy = (id: string, v: boolean) =>
    setBusyIds((prev) => ({ ...prev, [id]: v }));

  useEffect(() => {
    loadRaffles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRaffles() {
    try {
      setLoading(true);
      setErr(null);

const res = await fetch("/api/admin/rifas", { cache: "no-store" });
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
        status: (r.status ?? "active") as Raffle["status"],
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

  // crear rifa y redirigir a editar
  async function handleCreate() {
    try {
      setLoading(true);
const res = await fetch("/api/admin/rifas", {
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
if (!res.ok || !json?.ok || !json?.raffle?.id) {
  throw new Error(json?.error || "No se pudo crear la rifa");
}
router.push(`/admin/rifas/${json.raffle.id}/edit`);
    } catch (e: any) {
      alert(e.message || "Error creando rifa");
      await loadRaffles();
    } finally {
      setLoading(false);
    }
  }

  // toggle habilitar/deshabilitar
  async function handleToggleStatus(r: Raffle) {
    const next = r.status === "active" ? "inactive" : "active";
    try {
      setBusy(r.id, true);
      // optimista
      setRaffles((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, status: next } : x))
      );

const res = await fetch(`/api/admin/rifas/${r.id}`, {
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
      // revertir
      setRaffles((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, status: r.status } : x))
      );
    } finally {
      setBusy(r.id, false);
    }
  }

  // eliminar rifa
  async function handleDelete(r: Raffle) {
    if (
      !confirm(
        `¿Eliminar la rifa "${r.title}"?\nEsta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    try {
      setBusy(r.id, true);
      // optimista
      const prev = raffles;
      setRaffles((p) => p.filter((x) => x.id !== r.id));

      const res = await fetch(`/api/admin/rifas/${r.id}`, {
        method: "DELETE",
      });

      // el backend puede devolver 204 o JSON
      let ok = res.ok;
      if (res.headers.get("content-type")?.includes("application/json")) {
        const json = await res.json().catch(() => ({}));
        ok = ok && !!json?.ok;
        if (!ok) throw new Error(json?.error || "No se pudo eliminar");
      } else if (!ok) {
        throw new Error(`Error HTTP ${res.status}`);
      }
    } catch (e: any) {
      alert(e.message || "Error eliminando rifa");
      await loadRaffles();
    } finally {
      setBusy(r.id, false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-black/40 bg-black/70 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight">
              Gestión de Rifas
            </h1>
            <p className="text-xs sm:text-sm text-white/60">
              Administra tus rifas y su contenido
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => router.push("/admin/reservations")}
              className="px-4 py-2 rounded-xl font-semibold bg-white/10 hover:bg-white/15 border border-white/20 transition"
            >
              Reservas
            </button>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 rounded-xl font-semibold shadow hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-60"
              title="Crear nueva rifa"
              aria-label="Crear nueva rifa"
            >
              <span className="text-lg leading-none">＋</span>
              <span>Nueva</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-28 sm:pb-10">
        {/* estados */}
        {loading && (
          <div role="status" aria-live="polite" className="py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse"
              >
                <div className="h-32 rounded-xl bg-white/10 mb-4" />
                <div className="h-4 w-2/3 bg-white/10 rounded mb-2" />
                <div className="h-3 w-1/2 bg-white/10 rounded mb-4" />
                <div className="flex gap-2">
                  <div className="h-9 w-20 bg-white/10 rounded" />
                  <div className="h-9 w-24 bg-white/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && err && (
          <div className="text-center py-16">
            <p className="font-semibold text-rose-300">Error: {err}</p>
            <button
              onClick={loadRaffles}
              className="mt-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !err && (
          <Fragment>
            {/* grid responsive */}
            <section className="py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {raffles.map((raffle) => {
                const isBusy = !!busyIds[raffle.id];
                const active = raffle.status === "active";

                return (
                  <article
                    key={raffle.id}
                    className="group rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-gray-900 to-gray-950 hover:border-purple-500/60 transition"
                  >
                    {/* media */}
                    {raffle.banner_url ? (
                      <img
                        src={raffle.banner_url}
                        alt=""
                        className="h-36 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-36 w-full flex items-center justify-center text-white/40 bg-white/5">
                        Sin banner
                      </div>
                    )}

                    {/* body */}
                    <div className="p-4 flex flex-col gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base sm:text-lg truncate">
                            {raffle.title}
                          </h3>
                          <span className="text-[10px] sm:text-xs text-white/50 truncate">
                            /{raffle.slug}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-white/60 line-clamp-2">
                          {raffle.description || "Sin descripción."}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                        <span className="font-semibold text-amber-300">
                          RD$
                          {Number.isFinite(raffle.price)
                            ? raffle.price.toFixed(2)
                            : "0.00"}
                        </span>
                        <span className="text-white/30">•</span>
                        <span className="text-white/70">
                          Estado:{" "}
                          <span
                            className={`px-2 py-0.5 rounded border ${
                              active
                                ? "bg-emerald-900/30 border-emerald-700 text-emerald-300"
                                : "bg-white/5 border-white/15 text-white/80"
                            }`}
                          >
                            {active ? "active" : "inactive"}
                          </span>
                        </span>
                      </div>

                      {/* acciones — fila en mobile, columna en desktop */}
                      <div className="mt-1 flex flex-col sm:flex-row lg:flex-col gap-2">
                        <button
                          onClick={() =>
                            router.push(`/admin/rifas/${raffle.id}/edit`)
                          }
                          disabled={isBusy}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition shadow disabled:opacity-60"
                          aria-label={`Editar rifa ${raffle.title}`}
                          title="Editar rifa"
                        >
                          ✏️ Editar
                        </button>

                        <a
                          href={`/rifa/${raffle.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold bg-white/10 hover:bg-white/15 border border-white/15"
                          aria-label={`Ver pública ${raffle.title}`}
                          title="Ver pública"
                        >
                          👁️ Ver pública
                        </a>

                        <button
                          onClick={() => handleToggleStatus(raffle)}
                          disabled={isBusy}
                          className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold transition shadow disabled:opacity-60 ${
                            active
                              ? "bg-yellow-600 hover:bg-yellow-700"
                              : "bg-emerald-600 hover:bg-emerald-700"
                          }`}
                          aria-label={
                            active
                              ? `Deshabilitar ${raffle.title}`
                              : `Habilitar ${raffle.title}`
                          }
                          title={active ? "Deshabilitar" : "Habilitar"}
                        >
                          {active ? "Deshabilitar" : "Habilitar"}
                        </button>

                        <button
                          onClick={() => handleDelete(raffle)}
                          disabled={isBusy}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold bg-rose-600 hover:bg-rose-700 transition shadow disabled:opacity-60"
                          aria-label={`Eliminar ${raffle.title}`}
                          title="Eliminar rifa"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            {raffles.length === 0 && (
              <div className="text-center py-16 text-white/70">
                <p className="text-xl mb-2">No hay rifas disponibles</p>
                <p className="text-sm">Crea una rifa para comenzar</p>
                <div className="mt-4">
                  <button
                    onClick={handleCreate}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition shadow"
                  >
                    <span className="text-lg">＋</span>
                    <span>Nueva rifa</span>
                  </button>
                </div>
              </div>
            )}
          </Fragment>
        )}
      </main>

      {/* barra fija inferior (solo móvil) */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 bg-black/70 backdrop-blur border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push("/admin/reservations")}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold bg-white/10 hover:bg-white/15 border border-white/20"
          >
            🗂️ Reservas
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold bg-gradient-to-r from-purple-600 to-pink-600 shadow hover:from-purple-700 hover:to-pink-700 disabled:opacity-60"
          >
            ＋ Nueva
          </button>
        </div>
      </div>
    </div>
  );
}
