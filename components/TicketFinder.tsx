// components/TicketFinder.tsx
"use client";

import { useState } from "react";

type Row = {
  order_id: string;
  digits: string;
  telefono: string | null;
  correo: string | null;
  name: string | null;
  created_at: string;
};

export default function TicketFinder({ raffleId }: { raffleId: string }) {
  // Barra única
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  // resultados
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [revealsDigits, setRevealsDigits] = useState(false);
  const [mode, setMode] = useState<"digits" | "contact" | null>(null);

  // Modal
  const [open, setOpen] = useState(false);

  // Helpers
  const isFourDigits = (s: string) => /^[0-9]{4}$/.test(s.trim());
  const isEmailCom = (s: string) => /^[^\s@]+@[^\s@]+\.com$/i.test(s.trim());
  const onlyDigits = (s: string) => s.replace(/\D/g, "");

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setRows(null);
    setPending(false);
    setRevealsDigits(false);
    setMode(null);

    if (!raffleId) {
      setError("Falta el ID de la rifa.");
      setOpen(true);
      return;
    }

    const raw = (q || "").trim();
    if (!raw) {
      setError("Escribe 4 dígitos, un email .com o un teléfono.");
      setOpen(true);
      return;
    }

    // Decidir modo
    let url = "";
    if (isFourDigits(raw)) {
      setMode("digits");
      url = `/api/tickets/find?raffle=${raffleId}&digits=${encodeURIComponent(raw)}`;
    } else if (isEmailCom(raw)) {
      setMode("contact");
      url = `/api/tickets/find?raffle=${raffleId}&email=${encodeURIComponent(raw)}`;
    } else {
      const phone = onlyDigits(raw);
      if (!phone) {
        setError("Formato no válido. Usa 4 dígitos, email .com o teléfono.");
        setOpen(true);
        return;
      }
      setMode("contact");
      url = `/api/tickets/find?raffle=${raffleId}&phone=${encodeURIComponent(phone)}`;
    }

    setLoading(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "No se pudo buscar");
      }

      // bandera del backend
      setRevealsDigits(Boolean(json.reveals_digits));
      setPending(Boolean(json.pending));
      setRows(Array.isArray(json.rows) ? json.rows : []);
      setOpen(true);
    } catch (err: any) {
      setError(err?.message || "Error desconocido");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  // UI
  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-4 sm:p-5 mt-4">
      <h3 className="text-white text-lg font-semibold mb-3">Verificar boletos</h3>

      {/* Barra única */}
      <form onSubmit={onSearch} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Escribe 4 dígitos, email .com o teléfono"
          className="w-full rounded-xl bg-gray-800 text-white px-4 py-3 outline-none border border-gray-700 focus:border-indigo-500"
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />
        <button
          type="submit"
          disabled={loading}
          className="whitespace-nowrap rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 font-semibold disabled:opacity-50"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {/* Modal resultados */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
          aria-modal="true"
          role="dialog"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
          <button
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="relative w-full sm:max-w-2xl sm:rounded-2xl sm:overflow-hidden bg-gradient-to-br from-gray-900 to-black border border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h4 className="text-white font-bold truncate pr-4">Resultado de búsqueda</h4>
              <button
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-white"
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {/* Errores */}
              {error && (
                <div className="text-sm text-rose-300 bg-rose-900/30 border border-rose-800 rounded-xl px-4 py-2">
                  {error}
                </div>
              )}

              {/* Mensaje de pendiente si aplica */}
              {!error && pending && (
                <div className="text-sm text-amber-300 bg-amber-900/30 border border-amber-800 rounded-xl px-4 py-3 mb-3">
                  Tu pago fue recibido y tu reserva está en revisión. Los boletos se confirmarán en breve.
                </div>
              )}

              {/* Mostrar números SOLO si
                  1) el modo fue 'digits', y
                  2) el backend permitió revelar (reveals_digits=true) */}
              {!error && mode === "digits" && revealsDigits && rows && (
                <div className="bg-gray-800/60 rounded-2xl border border-gray-700">
                  {rows.length === 0 ? (
                    <div className="px-4 py-6 text-gray-300">No hay boletos con esos 4 dígitos.</div>
                  ) : (
                    <ul className="divide-y divide-gray-700">
                      {rows.map((r) => (
                        <li key={`${r.order_id}-${r.digits}`} className="p-4 text-gray-200">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-emerald-600/20 border border-emerald-700 text-emerald-300 font-mono font-bold">
                                {r.digits}
                              </span>
                              <div>
                                <div className="text-sm font-semibold">{r.name || "Cliente"}</div>
                                <div className="text-xs text-gray-400">
                                  {r.correo || "—"} {r.telefono ? `· ${r.telefono}` : ""}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(r.created_at).toLocaleString()}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Si la búsqueda fue por contacto, nunca mostramos números.
                  Mostramos un mensaje genérico según resultado/pending. */}
              {!error && mode === "contact" && (
                <div className="text-sm text-gray-300 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3">
                  {pending
                    ? "Hemos recibido tu pago y la reserva está en revisión."
                    : "No hay boletos confirmados aún para ese contacto."}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-700 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg font-semibold bg-gray-700 text-white hover:bg-gray-600"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
