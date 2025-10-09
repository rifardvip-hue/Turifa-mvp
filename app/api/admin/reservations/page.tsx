"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

type Row = {
  id: string;
  raffle_slug: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  amount_cents: number;
  status: "pending" | "confirmed" | "rejected";
  voucher_url?: string | null;
  ticket_blocks: any;
  created_at: string;
};

export default function AdminReservationsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [voucher, setVoucher] = useState<string | null>(null);

  async function fetchData(p = 1) {
    setLoading(true);
    const url = new URL("/api/admin/reservations", window.location.origin);
    if (q) url.searchParams.set("q", q);
    if (status) url.searchParams.set("status", status);
    url.searchParams.set("page", String(p));
    url.searchParams.set("pageSize", "20");
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    setRows(json.rows || []);
    setPage(p);
    setLoading(false);
  }

  useEffect(() => { fetchData(1); /* eslint-disable-next-line */ }, [status]);

  async function confirm(id: string) {
    const prev = [...rows];
    setRows(r => r.map(x => x.id === id ? { ...x, status: "confirmed" } : x));
    const res = await fetch(`/api/admin/reservations/${id}/confirm`, { method: "POST" });
    if (!res.ok) setRows(prev); // rollback
  }

  async function reject(id: string) {
    const note = prompt("Motivo de rechazo (opcional):") || "";
    const prev = [...rows];
    setRows(r => r.map(x => x.id === id ? { ...x, status: "rejected" } : x));
    const res = await fetch(`/api/admin/reservations/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) });
    if (!res.ok) setRows(prev);
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Administrar Reservas</h1>

      <div className="flex gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono"
          className="border rounded-lg px-3 py-2 w-full"
        />
        <button onClick={() => fetchData(1)} className="px-4 py-2 rounded-lg border">Buscar</button>
        <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded-lg px-2">
          <option value="pending">Pendiente</option>
          <option value="confirmed">Confirmado</option>
          <option value="rejected">Rechazado</option>
        </select>
      </div>

      {loading ? <p>Cargando…</p> : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Fecha</th>
                <th className="p-2 text-left">Cliente</th>
                <th className="p-2 text-left">Contacto</th>
                <th className="p-2 text-left">Rifa</th>
                <th className="p-2 text-left">Monto</th>
                <th className="p-2 text-left">Estado</th>
                <th className="p-2">Voucher</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2">{r.customer_name}</td>
                  <td className="p-2">
                    <div>{r.customer_email || '-'}</div>
                    <div>{r.customer_phone || '-'}</div>
                  </td>
                  <td className="p-2">{r.raffle_slug}</td>
                  <td className="p-2">RD${(r.amount_cents/100).toFixed(2)}</td>
                  <td className="p-2 font-medium">{r.status}</td>
                 <td className="p-2">
  {r.voucher_url
    ? <button
        onClick={async () => {
          const u = await fetch(`/api/admin/voucher-url/${r.id}`).then(r => r.json());
          setVoucher(u.url);
        }}
        className="underline"
      >
        Ver
      </button>
    : "—"}
</td>

                  <td className="p-2">
                    <div className="flex gap-2 justify-center">
                      <button disabled={r.status!=='pending'} onClick={() => confirm(r.id)} className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50">Confirmar</button>
                      <button disabled={r.status!=='pending'} onClick={() => reject(r.id)} className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50">Rechazar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="p-4 text-center text-gray-500">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {voucher && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6" onClick={() => setVoucher(null)}>
          <div className="bg-white rounded-xl p-4 max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">Voucher</h2>
              <button onClick={() => setVoucher(null)}>✕</button>
            </div>
            <div className="relative w-full h-[70vh]">
              {/* Si el voucher es imagen: */}
              <Image src={voucher} alt="Voucher" fill className="object-contain" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
