"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BannerUploader from "../_utils/BannerUploader";


type GalleryItem = { id: string; type: "image" | "video"; url: string; order: number };
type PaymentMethod = {
  id: string;
  name: string;
  type: "transfer" | "zelle" | "card" | string;
  account: string;
  holder: string;
  logo_url?: string | null;
  order: number;
};

type Raffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  total_tickets: number;
  bank_instructions?: string | null;
  banner_url?: string | null;
  media: {
    banner?: string | null;
    gallery: GalleryItem[];
    payments?: PaymentMethod[];
  };
};

type BankRow = {
  id: string;
  raffle_id: string;
  method: "transfer" | "zelle" | "card" | string;
  name: string;
  account?: string | null;
  holder?: string | null;
  logo_url?: string | null;
  extra?: string | null;
  order?: number | null;
};

function uid() {
  return "p_" + Math.random().toString(36).slice(2, 10);
}

export default function RaffleMediaEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // DB institutions
  const [banks, setBanks] = useState<BankRow[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  // edición inline de una fila DB
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftBank, setDraftBank] = useState<Partial<BankRow>>({});

  const galleryInputRef = useRef<HTMLInputElement>(null);

  // ------- LOADS -------
  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/raffles/${id}`, { cache: "no-store" });
    const j = await res.json();
    setLoading(false);
    if (!res.ok || !j?.ok) return alert(j?.error || "No se pudo cargar");
    const r = j.raffle as Raffle;
    if (!r.media) r.media = { banner: r.banner_url ?? null, gallery: [], payments: [] };
    if (!r.media.gallery) r.media.gallery = [];
    if (!r.media.payments) r.media.payments = [];
    r.media.gallery = [...r.media.gallery].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((m, i) => ({ ...m, order: i }));
    r.media.payments = [...r.media.payments].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((p, i) => ({ ...p, order: i }));
    setRaffle(r);
  }

  async function loadBanks() {
    if (!id) return;
    try {
      setLoadingBanks(true);
      const res = await fetch(`/api/admin/bank-institutions?raffle_id=${id}`, { cache: "no-store" });
      const j = await res.json();
      if (j?.ok && Array.isArray(j.items)) {
        const items = [...j.items].sort((a: BankRow, b: BankRow) => (a.order ?? 0) - (b.order ?? 0));
        setBanks(items);
      } else {
        setBanks([]);
      }
    } catch {
      setBanks([]);
    } finally {
      setLoadingBanks(false);
    }
  }

  useEffect(() => {
    load();
    loadBanks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ------- GALLERY -------
  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !raffle) return;
    setBusy(true);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);
const res = await fetch(`/api/admin/raffles/${raffle.id}/media`, { method: "POST", body: fd });

// --- parseo robusto ---
const ct = res.headers.get("content-type") || "";
let j: any = null;

if (res.status === 204) {
  j = { ok: true, gallery: raffle.media.gallery }; // servidor no envió cuerpo
} else if (ct.includes("application/json")) {
  j = await res.json().catch(() => null);
} else {
  const txt = await res.text().catch(() => "");
  j = txt ? { ok: false, error: txt } : null;
}

setBusy(false);
if (!res.ok || !j?.ok) {
  return alert(j?.error || `Error HTTP ${res.status}`);
}

setRaffle(prev =>
  prev ? { ...prev, media: { ...prev.media, gallery: j.gallery ?? prev.media.gallery } } : prev
);
e.target.value = "";
}

  function galleryRemove(id: string) {
    if (!raffle) return;
    const gallery = raffle.media.gallery.filter(m => m.id !== id).map((m, i) => ({ ...m, order: i }));
    setRaffle({ ...raffle, media: { ...raffle.media, gallery } });
  }
  function galleryMove(index: number, dir: "up" | "down") {
    if (!raffle) return;
    const g = [...raffle.media.gallery];
    const t = dir === "up" ? index - 1 : index + 1;
    if (t < 0 || t >= g.length) return;
    [g[index], g[t]] = [g[t], g[index]];
    const gallery = g.map((m, i) => ({ ...m, order: i }));
    setRaffle({ ...raffle, media: { ...raffle.media, gallery } });
  }

  // ------- BANNER -------
  async function uploadBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !raffle) return;
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
  const res = await fetch(`/api/admin/raffles/${raffle.id}/banner`, { method: "POST", body: fd });

// --- parseo robusto ---
const ct = res.headers.get("content-type") || "";
let j: any = null;
if (res.status === 204) {
  j = { ok: true, banner_url: raffle.banner_url ?? null };
} else if (ct.includes("application/json")) {
  j = await res.json().catch(() => null);
} else {
  const txt = await res.text().catch(() => "");
  j = txt ? { ok: false, error: txt } : null;
}

setBusy(false);
if (!res.ok || !j?.ok) return alert(j?.error || `Error HTTP ${res.status}`);

const newUrl = j.banner_url ?? raffle.banner_url ?? null;
setRaffle(prev => prev ? ({ ...prev, banner_url: newUrl, media: { ...prev.media, banner: newUrl } }) : prev);
e.target.value = "";
}


  // ------- PAYMENTS (draft nuevos) -------
  function paymentsAdd() {
    if (!raffle) return;
    const payments = [
      ...((raffle.media.payments ?? []).map((p, i) => ({ ...p, order: i }))),
      { id: uid(), name: "", type: "transfer" as const, account: "", holder: "", logo_url: null, order: (raffle.media.payments?.length ?? 0) },
    ];
    setRaffle({ ...raffle, media: { ...raffle.media, payments } });
  }
  function paymentsRemove(idx: number) {
    if (!raffle) return;
    const payments = (raffle.media.payments ?? []).filter((_, i) => i !== idx).map((p, i) => ({ ...p, order: i }));
    setRaffle({ ...raffle, media: { ...raffle.media, payments } });
  }
  function paymentsMove(index: number, dir: "up" | "down") {
    if (!raffle) return;
    const list = [...(raffle.media.payments ?? [])];
    const t = dir === "up" ? index - 1 : index + 1;
    if (t < 0 || t >= list.length) return;
    [list[index], list[t]] = [list[t], list[index]];
    const payments = list.map((p, i) => ({ ...p, order: i }));
    setRaffle({ ...raffle, media: { ...raffle.media, payments } });
  }
  function paymentsEdit<K extends keyof PaymentMethod>(idx: number, key: K, value: PaymentMethod[K]) {
    if (!raffle) return;
    const list = [...(raffle.media.payments ?? [])];
    list[idx] = { ...list[idx], [key]: value };
    setRaffle({ ...raffle, media: { ...raffle.media, payments: list } });
  }
  async function paymentsUploadLogo(idx: number) {
    if (!raffle) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      const fd = new FormData();
      fd.append("files", file);
    const res = await fetch(`/api/admin/raffles/${raffle.id}/media`, { method: "POST", body: fd });

// --- parseo robusto ---
const ct = res.headers.get("content-type") || "";
let j: any = null;
if (res.status === 204) {
  j = { ok: false, error: "El servidor no devolvió archivos" };
} else if (ct.includes("application/json")) {
  j = await res.json().catch(() => null);
} else {
  const txt = await res.text().catch(() => "");
  j = { ok: false, error: txt || "Respuesta no-JSON" };
}

setBusy(false);
if (!j?.ok || !Array.isArray(j.gallery) || j.gallery.length === 0) {
  return alert(j?.error || "No se pudo subir el logo");
}

const last = j.gallery[j.gallery.length - 1];
paymentsEdit(idx, "logo_url", last.url);
    };
}

async function saveRaffle() {
  if (!raffle) return;
  setBusy(true);

  try {
    console.log('🎯 ID de la rifa:', raffle.id);
    console.log('🎯 Precio ANTES de enviar:', raffle.price);
    console.log('🎯 Estado completo de raffle:', raffle);
    
    const payload = {
      title: raffle.title,
      description: raffle.description,
      bank_instructions: raffle.bank_instructions ?? "",
      price: Number(raffle.price),
      total_tickets: Number(raffle.total_tickets),
      banner_url: raffle.banner_url ?? raffle.media?.banner ?? null,
      media: {
        banner: raffle.banner_url ?? raffle.media?.banner ?? null,
        gallery: raffle.media?.gallery || [],
        payments: raffle.media?.payments || []
      }
    };

    console.log('📤 PAYLOAD COMPLETO:', JSON.stringify(payload, null, 2));
    
    const res = await fetch(`/api/admin/raffles/${raffle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log('📥 Status de respuesta:', res.status);

    // ... resto del código
  
    // 👇 REVALIDAR LA PÁGINA PÚBLICA
    try {
      console.log('🔄 Revalidando cache de la página pública...');
      const revalidateRes = await fetch(`/api/revalidate?path=/rifa/${raffle.slug}`, {
        method: 'POST'
      });
      
      if (revalidateRes.ok) {
        console.log('✅ Cache revalidado exitosamente');
      } else {
        console.warn('⚠️ No se pudo revalidar cache (endpoint no existe aún)');
      }
    } catch (e) {
      console.warn('⚠️ Error revalidando:', e);
    }
    
    setBusy(false);
    alert("✅ Rifa actualizada correctamente\n\n💡 Recarga la página pública (Cmd+Shift+R) para ver los cambios");

    await load();
    await loadBanks();

  } catch (error: any) {
    console.error('❌ Error crítico:', error);
    setBusy(false);
    alert(`❌ Error: ${error?.message || 'Error desconocido'}`);
  }
}

  // ------- EDITAR/ELIMINAR (DB) -------
  function startEdit(b: BankRow) {
    setEditingId(b.id);
    setDraftBank({ ...b });
  }
  function cancelEdit() {
    setEditingId(null);
    setDraftBank({});
  }

  async function updateBank() {
    if (!raffle?.id || !editingId) return;
    const payload = {
      id: editingId,
      name: (draftBank.name ?? "").trim(),
      type: (draftBank.method ?? "transfer") as any,
      account: (draftBank.account ?? "") || null,
      holder: (draftBank.holder ?? "") || null,
      logo_url: draftBank.logo_url ?? null,
      order: typeof draftBank.order === "number" ? draftBank.order : 0,
    };
    const res = await fetch(`/api/admin/raffles/${raffle.id}/media`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank: payload }),
    });
    const j = await res.json();
    if (!res.ok || !j?.ok) {
      alert(j?.error || "No se pudo actualizar la institución");
      return;
    }
    await loadBanks();
    cancelEdit();
  }

  async function deleteBank(bankId: string) {
    if (!raffle?.id) return;
    if (!confirm("¿Eliminar esta institución?")) return;
    const res = await fetch(`/api/admin/raffles/${raffle.id}/media?bank_id=${bankId}`, { method: "DELETE" });
    const j = await res.json();
    if (!res.ok || !j?.ok) {
      alert(j?.error || "No se pudo eliminar la institución");
      return;
    }
    await loadBanks();
    if (editingId === bankId) cancelEdit();
  }

  if (loading || !raffle) return <div className="p-6 text-gray-300">Cargando…</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/admin/reservations")}
                className="bg-white/10 hover:bg白/20 text-white px-3 py-2 rounded-lg font-semibold border border-white/30 transition-all"
                title="Volver al módulo de ventas"
              >
                ← Volver a Ventas
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black">Editar Rifa</h1>
                <p className="text-purple-100 mt-1">/{raffle.slug}</p>
              </div>
            </div>

            
          </div>
        </div>

        {/* Información básica */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-gray-700 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-2">Título</label>
            <input
              value={raffle.title}
              onChange={(e) => setRaffle({ ...raffle, title: e.target.value })}
              className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl focus:border-purple-500 focus:outline-none text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-2">Descripción</label>
            <textarea
              value={raffle.description ?? ""}
              onChange={(e) => setRaffle({ ...raffle, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl focus:border-purple-500 focus:outline-none text-white resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Precio</label>
              <input
                type="number" min={0} step="0.01"
                value={raffle.price}
                onChange={(e) => setRaffle({ ...raffle, price: Number(e.target.value || 0) })}
                className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Boletos totales</label>
              <input
                type="number" min={0}
                value={raffle.total_tickets}
                onChange={(e) => setRaffle({ ...raffle, total_tickets: Number(e.target.value || 0) })}
                className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-2">Instrucciones bancarias (texto libre)</label>
            <textarea
              value={raffle.bank_instructions ?? ""}
              onChange={(e) => setRaffle({ ...raffle, bank_instructions: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-white"
              placeholder={`Banco: ...\nCuenta: ...\nNombre: ...`}
            />
            <p className="text-xs text-gray-500 mt-1">Opcional. Para mejores opciones usa el editor de instituciones de abajo.</p>
          </div>
        </div>

        {/* Instituciones bancarias */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-bold">Instituciones bancarias</h2>
            <button
              onClick={paymentsAdd}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-xl font-semibold"
            >
              + Agregar institución
            </button>
          </div>

          {/* Lista DB con editar/eliminar */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Instituciones guardadas (DB)</h3>
            <div className="rounded-xl border border-gray-700 bg-black/30 p-3">
              {loadingBanks ? (
                <div className="text-gray-400 text-sm">Cargando instituciones…</div>
              ) : banks.length === 0 ? (
                <div className="text-gray-500 text-sm">No hay instituciones agregadas</div>
              ) : (
                <ul className="space-y-2">
                  {banks.map((b) => {
                    const isEditing = editingId === b.id;
                    return (
                      <li key={b.id} className="bg-gray-800/50 rounded-lg p-3">
                        {isEditing ? (
                          <div className="grid sm:grid-cols-5 gap-2 items-start">
                            <input
                              value={String(draftBank.name ?? "")}
                              onChange={(e) => setDraftBank((d) => ({ ...d, name: e.target.value }))}
                              className="px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
                              placeholder="Nombre"
                            />
                            <select
                              value={String(draftBank.method ?? "transfer")}
                              onChange={(e) => setDraftBank((d) => ({ ...d, method: e.target.value }))}
                              className="px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
                            >
                              <option value="transfer">Transferencia</option>
                              <option value="zelle">Zelle</option>
                              <option value="card">Tarjeta</option>
                            </select>
                            <input
                              value={String(draftBank.account ?? "")}
                              onChange={(e) => setDraftBank((d) => ({ ...d, account: e.target.value }))}
                              className="px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
                              placeholder="Cuenta / Email"
                            />
                            <input
                              value={String(draftBank.holder ?? "")}
                              onChange={(e) => setDraftBank((d) => ({ ...d, holder: e.target.value }))}
                              className="px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
                              placeholder="Titular"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={updateBank}
                                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white text-sm"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {b.logo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={b.logo_url} alt="" className="w-7 h-7 object-contain rounded" />
                              ) : (
                                <div className="w-7 h-7 rounded bg-gray-600" />
                              )}
                              <div className="min-w-0">
                                <div className="text-white font-semibold truncate">
                                  {b.name} <span className="text-xs text-gray-400">({b.method})</span>
                                </div>
                                <div className="text-xs text-gray-400 truncate">
                                  {[b.account, b.holder].filter(Boolean).join(" • ")}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startEdit(b)}
                                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => deleteBank(b.id)}
                                className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Editor de borradores (no guardados aún) */}
          {(raffle.media.payments ?? []).length === 0 ? (
            <div className="border-2 border-dashed border-gray-600 rounded-xl p-10 text-center text-gray-400">
              No hay instituciones agregadas
            </div>
          ) : (
            <div className="space-y-3">
              {(raffle.media.payments ?? []).map((p, i) => (
                <div key={p.id} className="bg-black/30 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-start gap-4">
                    <div className="w-24">
                      <div className="w-24 h-24 bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden border border-gray-700">
                        {p.logo_url
                          ? <img src={p.logo_url} className="w-full h-full object-contain" alt="logo" />
                          : <span className="text-gray-500 text-sm">Sin logo</span>}
                      </div>
                      <button
                        onClick={() => paymentsUploadLogo(i)}
                        className="mt-2 w-full bg-gray-700 hover:bg-gray-600 text-white text-sm py-1.5 rounded-lg"
                      >
                        Subir logo
                      </button>
                    </div>

                    <div className="flex-1 grid sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-gray-400 mb-1">Nombre de la institución</label>
                        <input
                          value={p.name}
                          onChange={(e) => paymentsEdit(i, "name", e.target.value)}
                          className="w-full px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
                          placeholder="Banco BHD / Banco Popular / Zelle, etc."
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                        <select
                          value={p.type}
                          onChange={(e) => paymentsEdit(i, "type", e.target.value)}
                          className="w-full px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
                        >
                          <option value="transfer">Transferencia</option>
                          <option value="zelle">Zelle</option>
                          <option value="card">Tarjeta</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          {p.type === "zelle" ? "Email de Zelle" : "Número de cuenta"}
                        </label>
                        <input
                          value={p.account}
                          onChange={(e) => paymentsEdit(i, "account", e.target.value)}
                          className="w-full px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
                          placeholder={p.type === "zelle" ? "ej: usuario@correo.com" : "ej: 1234567890"}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Titular</label>
                        <input
                          value={p.holder}
                          onChange={(e) => paymentsEdit(i, "holder", e.target.value)}
                          className="w-full px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
                          placeholder="Nombre del titular"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => paymentsMove(i, "up")}
                        disabled={i === 0}
                        className="w-10 h-10 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-30"
                        title="Subir"
                      >↑</button>
                      <button
                        onClick={() => paymentsMove(i, "down")}
                        disabled={i === (raffle.media.payments?.length ?? 1) - 1}
                        className="w-10 h-10 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-30"
                        title="Bajar"
                      >↓</button>
                      <button
                        onClick={() => paymentsRemove(i)}
                        className="w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                        title="Eliminar"
                      >✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Galería */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-bold">Galería ({raffle.media.gallery.length})</h2>
            <button
              onClick={() => galleryInputRef.current?.click()}
              disabled={busy}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
            >
              {busy ? "Subiendo..." : "+ Agregar"}
            </button>
          </div>

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleGalleryUpload}
          />

          {raffle.media.gallery.length === 0 ? (
            <div className="border-2 border-dashed border-gray-600 rounded-xl p-12 text-center text-gray-400">
              No hay medios agregados
            </div>
          ) : (
            <div className="space-y-3">
              {raffle.media.gallery
                .sort((a, b) => a.order - b.order)
                .map((m, i) => (
                <div key={m.id} className="bg-black/30 rounded-xl p-4 flex items-center gap-4 border border-gray-700">
                  <div className="flex-shrink-0">
                    {m.type === "video"
                      ? <video src={m.url} className="w-24 h-24 object-cover rounded-lg" muted />
                      : <img src={m.url} className="w-24 h-24 object-cover rounded-lg" alt="" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white">{m.type === "video" ? "🎥 Video" : "🖼️ Imagen"} · #{i + 1}</div>
                    <div className="text-gray-400 text-sm truncate">{m.url}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => galleryMove(i, "up")} disabled={i === 0}
                      className="w-10 h-10 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-30">↑</button>
                    <button onClick={() => galleryMove(i, "down")} disabled={i === raffle.media.gallery.length - 1}
                      className="w-10 h-10 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-30">↓</button>
                    <button onClick={() => galleryRemove(m.id)}
                      className="w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-lg">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* --- BLOQUE NUEVO: Subir Banner --- */}
<BannerUploader
  raffleId={raffle.id}
  initialBanner={raffle.media?.banner || raffle.banner_url || null}
  onChange={(newUrl) => {
    setRaffle((prev: any) =>
      prev
        ? { ...prev, media: { ...(prev.media || {}), banner: newUrl }, banner_url: newUrl }
        : prev
    );
  }}
/>


        {/* Preview + Guardar */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold">Vista previa</h2>
            <div className="text-sm text-gray-400">Banner actual: {raffle.banner_url ? "sí" : "no"}</div>
          </div>
          <div className="bg-black rounded-xl overflow-hidden">
            <div className="bg-black text-white p-3 flex justify-between items-center border-b border-gray-700">
              <div className="font-bold">{raffle.title}</div>
              <div className="text-sm text-orange-400">RD${(raffle.price ?? 0).toFixed(2)}</div>
            </div>
            {raffle.banner_url
              ? <img src={raffle.banner_url} className="w-full h-48 object-cover" alt="Banner" />
              : <div className="h-48 bg-gray-800 flex items-center justify-center text-gray-500">Sin banner</div>}
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={saveRaffle}
            className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-xl font-bold text-lg">
            💾 Guardar cambios
          </button>
          <button onClick={() => router.push("/admin/rifas")}
            className="px-6 bg-gray-700 text-white py-4 rounded-xl font-bold">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
