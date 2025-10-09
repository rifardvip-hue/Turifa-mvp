"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  raffle_slug: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  amount_cents: number;
  status: "pending" | "confirmed" | "rejected" | "pending_review";
  voucher_url?: string | null;
  ticket_blocks: any;
  created_at: string;
};

function toDigitsList(tb: any): string[] {
  if (!tb) return [];
  if (Array.isArray(tb)) {
    return tb
      .map((x) =>
        typeof x === "string" ? x : typeof x?.digits === "string" ? x.digits : ""
      )
      .filter((x) => /^[0-9]{4}$/.test(x));
  }
  if (Array.isArray(tb?.tickets)) {
    return tb.tickets
      .map((t: any) => (typeof t === "string" ? t : t?.digits))
      .filter((x: any) => /^[0-9]{4}$/.test(x));
  }
  return [];
}

export default function AdminReservationsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Row | null>(null);
  const [voucher, setVoucher] = useState<string | null>(null);

  // 👇 ver boletos
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [tickets, setTickets] = useState<string[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const totalRD$ = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.amount_cents || 0) / 100, 0),
    [rows]
  );

  async function fetchData(p = 1) {
    setLoading(true);
    const url = new URL("/api/admin/reservations", window.location.origin);
    if (q) url.searchParams.set("q", q);
    if (status) url.searchParams.set("status", status);
    url.searchParams.set("page", String(p));
    url.searchParams.set("pageSize", "20");

    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const json = await res.json();
    setRows(json.rows || []);
    setPage(p);
    setLoading(false);
  }

  useEffect(() => {
    fetchData(1);
  }, [status]);

  async function confirm(id: string) {
    const prev = [...rows];
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status: "confirmed" } : x)));

    try {
      // 1) tu endpoint actual (si existe)
      let res = await fetch(`/api/admin/orders/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      // 2) si no existe o falla, fallback al endpoint idempotente
      if (!res.ok) {
        res = await fetch(`/api/orders/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ order_id: id }),
        });
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "(sin cuerpo)");
        console.error("❌ Confirm API error:", res.status, text);
        setRows(prev);
        return;
      }

      // opcional: leer tickets devueltos si el fallback respondió con ellos
      try {
        const json = await res.json();
        if (Array.isArray(json?.tickets) && json.tickets.length) {
          setTickets(json.tickets.map(String));
          setTicketsOpen(true);
        }
      } catch {
        /* no-op */
      }

      await fetchData(page);
      setSelected(null);
    } catch (e) {
      console.error("❌ Confirm fetch threw:", e);
      setRows(prev);
    }
  }

  async function reject(id: string) {
    const note = prompt("Motivo de rechazo (opcional):") || "";
    const prev = [...rows];
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status: "rejected" } : x)));

    try {
      const res = await fetch(`/api/admin/orders/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ note }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "(sin cuerpo)");
        console.error("❌ Reject API error:", res.status, text);
        setRows(prev);
        return;
      }

      await fetchData(page);
      setSelected(null);
    } catch (e) {
      console.error("❌ Reject fetch threw:", e);
      setRows(prev);
    }
  }

  // ver boletos (usa ticket_blocks si ya viene; si no, usa endpoint idempotente)
  async function viewTickets(order: Row) {
    setLoadingTickets(true);
    try {
      const local = toDigitsList(order.ticket_blocks);
      if (local.length > 0) {
        setTickets(local);
        setTicketsOpen(true);
        return;
      }

      const res = await fetch("/api/orders/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ order_id: order.id }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok || !Array.isArray(json?.tickets)) {
        alert(json?.error || "No se pudieron obtener los boletos");
        return;
      }

      setTickets(json.tickets.map(String));
      setTicketsOpen(true);
    } finally {
      setLoadingTickets(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px_4 sm:px-6 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">🎫 Administrar Reservas</h1>
              <p className="text-blue-100 text-sm mt-1">Gestiona todas las reservas de rifas</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 sm:px-6 py-3 border border-white/30">
                <p className="text-xs text-blue-100 mb-1">Total en página</p>
                <p className="text-xl sm:text-2xl font-bold">RD${totalRD$.toFixed(2)}</p>
              </div>
              <button
                onClick={() => (window.location.href = "/admin/rifas")}
                className="bg-white text-purple-600 px-4 sm:px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-all flex items-center gap-2 shadow-lg"
              >
                <span className="text-xl">🎰</span>
                <span className="hidden sm:inline">Gestionar Rifas</span>
                <span className="sm:hidden">Rifas</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="🔍 Buscar por nombre, email o teléfono..."
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-purple-500 focus:outline-none transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && fetchData(1)}
                />
              </div>
              <button
                onClick={() => fetchData(1)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all"
              >
                Buscar
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {["", "pending", "pending_review", "confirmed", "rejected"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    status === s
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {s === "" && "📋 Todos"}
                  {s === "pending" && "⏳ Pendiente"}
                  {s === "pending_review" && "👀 En Revisión"}
                  {s === "confirmed" && "✅ Confirmado"}
                  {s === "rejected" && "❌ Rechazado"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-purple-600"></div>
            <p className="mt-4 text-gray-600">Cargando reservas...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      📅 Fecha
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      👤 Cliente
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase hidden sm:table-cell">
                      🎰 Rifa
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      💰 Monto
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      📊 Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all"
                      onClick={() => setSelected(r)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(r.created_at).toLocaleDateString()}
                        <div className="text-xs text-gray-400 sm:hidden">
                          {new Date(r.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">{r.customer_name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[150px] sm:max-w-none">
                          {r.customer_email || r.customer_phone || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 hidden sm:table-cell">
                        {r.raffle_slug}
                      </td>
                      <td className="px-4 py-4 font-semibold text-gray-900">
                        RD${(Number(r.amount_cents || 0) / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-4">
                        {r.status === "confirmed" && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            ✓ Confirmado
                          </span>
                        )}
                        {r.status === "pending" && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                            ⏳ Pendiente
                          </span>
                        )}
                        {r.status === "pending_review" && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                            👀 Revisión
                          </span>
                        )}
                        {r.status === "rejected" && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                            ✕ Rechazado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <div className="text-gray-400 text-lg">📭</div>
                        <p className="text-gray-500 mt-2">No hay reservas para mostrar</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal de Detalles */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-3xl">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Detalles de Reserva</h2>
                <button
                  onClick={() => setSelected(null)}
                  className="text-white/80 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-4">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">👤</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Cliente</p>
                    <p className="text-lg font-semibold text-gray-900">{selected.customer_name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-2xl">📧</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Email</p>
                    <p className="text-gray-700">{selected.customer_email || "No proporcionado"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-2xl">📱</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Teléfono</p>
                    <p className="text-gray-700">{selected.customer_phone || "No proporcionado"}</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🎰</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Rifa</p>
                    <p className="text-gray-900 font-medium">{selected.raffle_slug}</p>
                  </div>
                </div>

                {"quantity" in selected && (
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🎫</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 uppercase font-semibold">Cantidad</p>
                      <p className="text-gray-900 font-medium">{(selected as any).quantity}</p>
                    </div>
                  </div>
                )}

                {"price" in selected && (
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💵</span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 uppercase font-semibold">Precio por boleto</p>
                      <p className="text-gray-900 font-medium">
                        RD${Number((selected as any).price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <span className="text-2xl">💰</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Monto Total</p>
                    <p className="text-2xl font-bold text-purple-600">
                      RD${(Number(selected.amount_cents || 0) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {selected.ticket_blocks && toDigitsList(selected.ticket_blocks).length > 0 && (
                <div className="bg-emerald-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🎲</span>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Números Seleccionados</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {toDigitsList(selected.ticket_blocks).map((d) => (
                      <span
                        key={d}
                        className="inline-flex items-center justify-center px-4 py-2 bg-white border-2 border-emerald-200 rounded-xl font-bold text-emerald-700 text-lg shadow-sm"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selected.voucher_url && (
                <button
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all flex items-center justify-center gap-2"
                  onClick={() => setVoucher(selected.voucher_url!)}
                >
                  <span className="text-xl">🧾</span>
                  Ver Comprobante de Pago
                </button>
              )}
            </div>

            {/* Footer con acciones */}
            <div className="bg-gray-50 p-6 rounded-b-3xl flex flex-col sm:flex-row gap-3">
              <button
                className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                onClick={() => confirm(selected.id)}
                disabled={selected.status === "confirmed"}
              >
                <span className="text-xl">✓</span>
                Confirmar Reserva
              </button>
              <button
                className="flex-1 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={() => viewTickets(selected)}
                disabled={loadingTickets}
                title="Ver boletos del cliente"
              >
                <span className="text-xl">🎟️</span>
                {loadingTickets ? "Cargando..." : "Ver boletos"}
              </button>
              <button
                className="flex-1 bg-gradient-to-r from-rose-500 to-rose-600 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                onClick={() => reject(selected.id)}
                disabled={selected.status === "rejected"}
              >
                <span className="text-xl">✕</span>
                Rechazar Reserva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Voucher */}
      {voucher && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setVoucher(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Comprobante de Pago</h2>
              <button
                onClick={() => setVoucher(null)}
                className="text-white/80 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-all"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-gray-50">
              <div className="w-full h-[70vh] bg-white rounded-xl shadow-inner p-2">
                <img
                  src={voucher}
                  alt="Voucher"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Boletos */}
      {ticketsOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setTicketsOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-5 rounded-t-3xl flex justify-between items-center">
              <h3 className="text-lg font-bold">Boletos generados</h3>
              <button
                onClick={() => setTicketsOpen(false)}
                className="text-white/80 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {tickets.length === 0 ? (
                <p className="text-gray-600">No hay boletos para mostrar.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tickets.map((t) => (
                    <span
                      key={t}
                      className="px-4 py-2 rounded-xl font-mono font-bold bg-gradient-to-br from-orange-600 to-amber-600 text-white shadow"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(tickets.join(", "))}
                  className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
                >
                  Copiar
                </button>
                <button
                  onClick={() => setTicketsOpen(false)}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
