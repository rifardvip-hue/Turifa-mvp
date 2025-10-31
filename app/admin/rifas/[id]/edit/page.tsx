"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BannerUploader from "../_utils/BannerUploader";

type GalleryItem = { id: string; type: "image" | "video"; url: string; order: number };

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
    const res = await fetch(`/api/admin/rifas/${id}`, { cache: "no-store" });
    const j = await res.json();
    setLoading(false);
    if (!res.ok || !j?.ok) return alert(j?.error || "No se pudo cargar");
    const r = j.raffle as Raffle;
    if (!r.media) r.media = { banner: r.banner_url ?? null, gallery: [] };
    if (!r.media.gallery) r.media.gallery = [];
    r.media.gallery = [...r.media.gallery]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((m, i) => ({ ...m, order: i }));
    setRaffle(r);
  }

  async function loadBanks() {
    if (!id) return;
    try {
      setLoadingBanks(true);
      const res = await fetch(`/api/admin/bank-institutions?raffle_id=${id}`, { cache: "no-store" });
      const j = await res.json();
      if (j?.ok && Array.isArray(j.items)) {
        const items = [...j.items].sort(
          (a: BankRow, b: BankRow) => (a.order ?? 0) - (b.order ?? 0)
        );
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
    const res = await fetch(`/api/admin/rifas/${raffle.id}/media`, {
  method: "POST",
  body: fd,
  cache: "no-store", // 👈 evita que el navegador mezcle respuestas antiguas
});
    // --- parseo robusto ---
    const ct = res.headers.get("content-type") || "";
    let j: any = null;

    if (res.status === 204) {
      j = { ok: true, gallery: raffle.media.gallery };
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
      prev
        ? { ...prev, media: { ...prev.media, gallery: j.gallery ?? prev.media.gallery } }
        : prev
    );
    e.target.value = "";
  }

// 🔻 Reemplaza esta función en app/admin/rifas/[id]/edit/page.tsx
async function galleryRemove(mediaId: string) {
  if (!raffle?.id) return;

  try {
    const res = await fetch(
      `/api/admin/rifas/${raffle.id}/media?media_id=${mediaId}`,
      { method: "DELETE", cache: "no-store" }
    );
    const json = await res.json();

    if (!res.ok || !json?.ok) {
      alert(json?.error || "No se pudo eliminar el archivo");
      return;
    }

    // ⚠️ IMPORTANTE: reemplazamos la lista con la que devuelve el back
    setRaffle((prev) =>
      prev
        ? { ...prev, media: { ...prev.media, gallery: json.gallery ?? [] } }
        : prev
    );
  } catch (e) {
    console.error(e);
    alert("Error al eliminar el archivo");
  }
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

  // ------- INSTITUCIONES BANCARIAS -------
  // ✅ Crear institución directamente en DB
  async function paymentsAdd() {
    if (!raffle?.id) return;
    
    setBusy(true);
    
    try {
      const payload = {
        raffle_id: raffle.id,
        method: "transfer",
        name: "Nueva Institución",
        account: null,
        holder: null,
        logo_url: null,
        extra: null,
        order: banks.length,
      };

      const res = await fetch("/api/admin/bank-institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        alert(json?.error || "Error al crear institución");
        setBusy(false);
        return;
      }

      await loadBanks();
      
      // Entrar en modo edición del nuevo banco
      if (json.bank?.id || json.item?.id) {
        const bankId = json.bank?.id || json.item?.id;
        setEditingId(bankId);
        setDraftBank(json.bank || json.item);
      }

      setBusy(false);
    } catch (error: any) {
      console.error("Error en paymentsAdd:", error);
      alert("Error al crear institución");
      setBusy(false);
    }
  }

  // ✅ Subir logo de banco guardado
  async function uploadBankLogo(bankId: string) {
    if (!raffle?.id) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setBusy(true);
      const fd = new FormData();
      fd.append("file", file);

      try {
        const res = await fetch(`/api/admin/bank-institutions/${bankId}/logo`, {
          method: "POST",
          body: fd,
        });

        const json = await res.json();

        if (!res.ok || !json?.ok) {
          alert(json?.error || "Error al subir logo");
          setBusy(false);
          return;
        }

        // Actualizar el logo en el draft si está editando
        if (editingId === bankId && json.logo_url) {
          setDraftBank((d) => ({ ...d, logo_url: json.logo_url }));
        }

        // Recargar bancos
        await loadBanks();
        setBusy(false);
      } catch (error: any) {
        console.error("Error subiendo logo:", error);
        alert("Error al subir logo");
        setBusy(false);
      }
    };

    input.click();
  }

  // ✅ Guardar cambios en la rifa (sin payments)
  async function saveRaffle() {
    if (!raffle) return;
    setBusy(true);

    try {
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
          // ✅ NO guardar payments aquí - se manejan por separado en bank_institutions
        },
      };

      const res = await fetch(`/api/admin/rifas/${raffle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Revalidación "best effort"
      try {
        await fetch(`/api/revalidate?path=/rifa/${raffle.slug}`, { method: "POST" });
      } catch {}

      setBusy(false);
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        alert(t || "Error al guardar");
        return;
      }

      alert("✅ Rifa actualizada correctamente\n\n💡 Refresca la página pública para ver cambios");
      await load();
      await loadBanks();
    } catch (error: any) {
      setBusy(false);
      alert(`❌ Error: ${error?.message || "Error desconocido"}`);
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

  // ✅ Actualizar banco usando endpoint correcto
  async function updateBank() {
    if (!raffle?.id || !editingId) return;
    
    setBusy(true);
    
    const payload = {
      name: (draftBank.name ?? "").trim(),
      method: (draftBank.method ?? "transfer") as any,
      account: (draftBank.account ?? "") || null,
      holder: (draftBank.holder ?? "") || null,
      logo_url: draftBank.logo_url ?? null,
      extra: (draftBank.extra ?? "") || null,
      order: typeof draftBank.order === "number" ? draftBank.order : 0,
    };

    try {
      const res = await fetch(`/api/admin/bank-institutions/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        alert(json?.error || "Error al actualizar");
        setBusy(false);
        return;
      }

      await loadBanks();
      cancelEdit();
      setBusy(false);
    } catch (error: any) {
      console.error("Error en updateBank:", error);
      alert("Error al actualizar institución");
      setBusy(false);
    }
  }

  // ✅ Eliminar banco usando endpoint correcto
  async function deleteBank(bankId: string) {
    if (!raffle?.id) return;
    if (!confirm("¿Eliminar esta institución?")) return;
    
    setBusy(true);
    
    try {
      const res = await fetch(`/api/admin/bank-institutions/${bankId}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        alert(json?.error || "No se pudo eliminar la institución");
        setBusy(false);
        return;
      }

      await loadBanks();
      if (editingId === bankId) cancelEdit();
      setBusy(false);
    } catch (error: any) {
      console.error("Error en deleteBank:", error);
      alert("Error al eliminar institución");
      setBusy(false);
    }
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
                className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg font-semibold border border-white/30 transition-all"
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
                type="number"
                min={0}
                step="0.01"
                value={raffle.price}
                onChange={(e) => setRaffle({ ...raffle, price: Number(e.target.value || 0) })}
                className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-2">Boletos totales</label>
              <input
                type="number"
                min={0}
                value={raffle.total_tickets}
                onChange={(e) => setRaffle({ ...raffle, total_tickets: Number(e.target.value || 0) })}
                className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-2">
              Instrucciones bancarias (texto libre)
            </label>
            <textarea
              value={raffle.bank_instructions ?? ""}
              onChange={(e) => setRaffle({ ...raffle, bank_instructions: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-white"
              placeholder={`Banco: ...\nCuenta: ...\nNombre: ...`}
            />
            <p className="text-xs text-gray-500 mt-1">
              Opcional. Para mejores opciones usa el editor de instituciones de abajo.
            </p>
          </div>
        </div>

        {/* Instituciones bancarias */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-bold">Instituciones bancarias</h2>
            <button
              onClick={paymentsAdd}
              disabled={busy}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
            >
              + Agregar institución
            </button>
          </div>

          {/* Lista DB con editar/eliminar */}
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
                        <div className="space-y-3">
                          {/* Nombre */}
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Nombre</label>
                            <input
                              value={String(draftBank.name ?? "")}
                              onChange={(e) => setDraftBank((d) => ({ ...d, name: e.target.value }))}
                              className="w-full px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
                              placeholder="Banco BHD"
                            />
                          </div>

                          {/* Método */}
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Método</label>
                            <select
                              value={String(draftBank.method ?? "transfer")}
                              onChange={(e) => setDraftBank((d) => ({ ...d, method: e.target.value as any }))}
                              className="w-full px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
                            >
                              <option value="transfer">Transferencia</option>
                              <option value="zelle">Zelle</option>
                              <option value="card">Tarjeta</option>
                            </select>
                          </div>

                          {/* Cuenta */}
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Número de cuenta</label>
                            <input
                              value={String(draftBank.account ?? "")}
                              onChange={(e) => setDraftBank((d) => ({ ...d, account: e.target.value }))}
                              className="w-full px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
                              placeholder="1234567890"
                            />
                          </div>

                          {/* Titular */}
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Titular</label>
                            <input
                              value={String(draftBank.holder ?? "")}
                              onChange={(e) => setDraftBank((d) => ({ ...d, holder: e.target.value }))}
                              className="w-full px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-white"
                              placeholder="Nombre del titular"
                            />
                          </div>

                          {/* Logo */}
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Logo</label>
                            <div className="flex items-center gap-3">
                              {draftBank.logo_url && (
                                <img 
                                  src={draftBank.logo_url} 
                                  className="w-12 h-12 object-contain bg-white/5 rounded-lg p-1" 
                                  alt="logo" 
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => uploadBankLogo(b.id)}
                                disabled={busy}
                                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg disabled:opacity-50"
                              >
                                {draftBank.logo_url ? "Cambiar logo" : "Subir logo"}
                              </button>
                            </div>
                          </div>

                          {/* Botones */}
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={updateBank}
                              disabled={busy}
                              className="flex-1 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={busy}
                              className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            {b.logo_url && (
                              <img 
                                src={b.logo_url} 
                                className="w-12 h-12 object-contain bg-white/5 rounded-lg p-1" 
                                alt="logo" 
                              />
                            )}
                            <div className="flex-1">
                              <div className="text-white font-semibold">{b.name}</div>
                              <div className="text-sm text-gray-400">
                                {b.method === "transfer" ? "Transferencia" : b.method === "zelle" ? "Zelle" : "Tarjeta"}
                              </div>
                              {b.account && <div className="text-xs text-gray-500 font-mono">{b.account}</div>}
                              {b.holder && <div className="text-xs text-gray-500">{b.holder}</div>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEdit(b)}
                              disabled={busy}
                              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => deleteBank(b.id)}
                              disabled={busy}
                              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-50"
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
                  <div
                    key={m.id}
                    className="bg-black/30 rounded-xl p-4 flex items-center gap-4 border border-gray-700"
                  >
                    <div className="flex-shrink-0">
                      {m.type === "video" ? (
                        <video src={m.url} className="w-24 h-24 object-cover rounded-lg" muted />
                      ) : (
                        <img src={m.url} className="w-24 h-24 object-cover rounded-lg" alt="" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white">
                        {m.type === "video" ? "🎥 Video" : "🖼️ Imagen"} · #{i + 1}
                      </div>
                      <div className="text-gray-400 text-sm truncate">{m.url}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => galleryMove(i, "up")}
                        disabled={i === 0}
                        className="w-10 h-10 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => galleryMove(i, "down")}
                        disabled={i === raffle.media.gallery.length - 1}
                        className="w-10 h-10 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => galleryRemove(m.id)}
                        className="w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Banner */}
        <BannerUploader
          raffleId={raffle.id}
          initialBanner={raffle.media?.banner || raffle.banner_url || null}
          onChange={(newUrl) => {
            setRaffle((prev: any) =>
              prev ? { ...prev, media: { ...(prev.media || {}), banner: newUrl }, banner_url: newUrl } : prev
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
            {raffle.banner_url ? (
              <img src={raffle.banner_url} className="w-full h-48 object-cover" alt="Banner" />
            ) : (
              <div className="h-48 bg-gray-800 flex items-center justify-center text-gray-500">Sin banner</div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={saveRaffle}
            disabled={busy}
            className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50"
          >
            {busy ? "Guardando..." : "💾 Guardar cambios"}
          </button>
          <button
            onClick={() => router.push("/admin/rifas")}
            disabled={busy}
            className="px-6 bg-gray-700 text-white py-4 rounded-xl font-bold disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}