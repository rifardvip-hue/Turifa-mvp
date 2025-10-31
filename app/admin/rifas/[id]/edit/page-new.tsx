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

  const [banks, setBanks] = useState<BankRow[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftBank, setDraftBank] = useState<Partial<BankRow>>({});

  const galleryInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(\`/api/admin/rifas/\${id}\`, { cache: "no-store" });
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
      const res = await fetch(\`/api/admin/bank-institutions?raffle_id=\${id}\`, { cache: "no-store" });
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
  }, [id]);

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !raffle) return;
    setBusy(true);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);
    const res = await fetch(\`/api/admin/rifas/\${raffle.id}/media\`, { method: "POST", body: fd });

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
      return alert(j?.error || \`Error HTTP \${res.status}\`);
    }

    setRaffle(prev =>
      prev
        ? { ...prev, media: { ...prev.media, gallery: j.gallery ?? prev.media.gallery } }
        : prev
    );
    e.target.value = "";
  }

 // 🔻 Reemplaza esta función en app/admin/rifas/[id]/edit/page-new.tsx
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

    // ⚠️ Reemplaza la lista con la que devuelve el backend
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
      if (json.bank?.id || json.item?.id) {
        const bankId = json.bank?.id || json.item?.id;
        setEditingId(bankId);
        setDraftBank(json.bank || json.item);
      }
      setBusy(false);
    } catch (error: any) {
      console.error("Error:", error);
      alert("Error al crear institución");
      setBusy(false);
    }
  }

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
        const res = await fetch(\`/api/admin/bank-institutions/\${bankId}/logo\`, {
          method: "POST",
          body: fd,
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          alert(json?.error || "Error al subir logo");
          setBusy(false);
          return;
        }
        if (editingId === bankId && json.logo_url) {
          setDraftBank((d) => ({ ...d, logo_url: json.logo_url }));
        }
        await loadBanks();
        setBusy(false);
      } catch (error: any) {
        console.error("Error:", error);
        alert("Error al subir logo");
        setBusy(false);
      }
    };
    input.click();
  }

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
        },
      };
      const res = await fetch(\`/api/admin/rifas/\${raffle.id}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      try {
        await fetch(\`/api/revalidate?path=/rifa/\${raffle.slug}\`, { method: "POST" });
      } catch {}
      setBusy(false);
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        alert(t || "Error al guardar");
        return;
      }
      alert("✅ Rifa actualizada");
      await load();
      await loadBanks();
    } catch (error: any) {
      setBusy(false);
      alert(\`❌ Error: \${error?.message || "Error desconocido"}\`);
    }
  }

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
      const res = await fetch(\`/api/admin/bank-institutions/\${editingId}\`, {
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
      console.error("Error:", error);
      alert("Error al actualizar");
      setBusy(false);
    }
  }

  async function deleteBank(bankId: string) {
    if (!raffle?.id) return;
    if (!confirm("¿Eliminar esta institución?")) return;
    setBusy(true);
    try {
      const res = await fetch(\`/api/admin/bank-institutions/\${bankId}\`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        alert(json?.error || "No se pudo eliminar");
        setBusy(false);
        return;
      }
      await loadBanks();
      if (editingId === bankId) cancelEdit();
      setBusy(false);
    } catch (error: any) {
      console.error("Error:", error);
      alert("Error al eliminar");
      setBusy(false);
    }
  }

  if (loading || !raffle) return <div className="p-6 text-gray-300">Cargando…</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl p-6 shadow-2xl">
          <button
            onClick={() => router.push("/admin/reservations")}
            className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg font-semibold mb-3"
          >
            ← Volver
          </button>
          <h1 className="text-2xl font-black">Editar Rifa</h1>
          <p className="text-purple-100 mt-1">{raffle.slug}</p>
        </div>

        {/* Info básica */}
        <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-gray-400 mb-2">Título</label>
            <input
              value={raffle.title}
              onChange={(e) => setRaffle({ ...raffle, title: e.target.value })}
              className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-white"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-2">Descripción</label>
            <textarea
              value={raffle.description ?? ""}
              onChange={(e) => setRaffle({ ...raffle, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-white"
            />
          </div>
        </div>

        {/* Instituciones */}
        <div className="bg-gray-800 rounded-2xl p-6">
          <div className="flex justify-between mb-4">
            <h2 className="text-white font-bold">Instituciones bancarias</h2>
            <button
              onClick={paymentsAdd}
              disabled={busy}
              className="bg-purple-600 text-white px-4 py-2 rounded-xl disabled:opacity-50"
            >
              + Agregar
            </button>
          </div>
          
          {loadingBanks ? (
            <div className="text-gray-400">Cargando...</div>
          ) : banks.length === 0 ? (
            <div className="text-gray-500">Sin instituciones</div>
          ) : (
            <ul className="space-y-2">
              {banks.map((b) => (
                <li key={b.id} className="bg-gray-900/50 rounded-lg p-3">
                  {editingId === b.id ? (
                    <div className="space-y-3">
                      <input
                        value={draftBank.name ?? ""}
                        onChange={(e) => setDraftBank({ ...draftBank, name: e.target.value })}
                        placeholder="Nombre"
                        className="w-full px-3 py-2 bg-black/50 border border-gray-700 rounded text-white"
                      />
                      <input
                        value={draftBank.account ?? ""}
                        onChange={(e) => setDraftBank({ ...draftBank, account: e.target.value })}
                        placeholder="Cuenta"
                        className="w-full px-3 py-2 bg-black/50 border border-gray-700 rounded text-white"
                      />
                      <button
                        onClick={() => uploadBankLogo(b.id)}
                        disabled={busy}
                        className="px-3 py-2 bg-gray-700 text-white rounded disabled:opacity-50"
                      >
                        {draftBank.logo_url ? "Cambiar logo" : "Subir logo"}
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={updateBank}
                          disabled={busy}
                          className="flex-1 bg-green-600 text-white py-2 rounded disabled:opacity-50"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="bg-gray-700 text-white px-4 py-2 rounded"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {b.logo_url && <img src={b.logo_url} className="w-10 h-10 object-contain" alt="" />}
                        <div>
                          <div className="text-white font-semibold">{b.name}</div>
                          <div className="text-gray-400 text-sm">{b.account}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(b)}
                          className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteBank(b.id)}
                          className="px-3 py-2 bg-red-600 text-white rounded text-sm"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Galería */}
        <div className="bg-gray-800 rounded-2xl p-6">
          <button
            onClick={() => galleryInputRef.current?.click()}
            disabled={busy}
            className="bg-orange-600 text-white px-4 py-2 rounded-xl mb-4"
          >
            + Galería
          </button>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleGalleryUpload}
          />
  {raffle.media.gallery
  .slice() // copia
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) // ordena por "order"
  .map((m, i) => (
    <div key={m.id} className="flex gap-4 mb-2">
      {m.type === "video" ? (
        <video src={m.url} className="w-20 h-20 rounded" muted />
      ) : (
        <img src={m.url} className="w-20 h-20 rounded object-cover" alt="" />
      )}
      <button onClick={() => galleryRemove(m.id)} className="text-red-500">✕</button>
    </div>
  ))}
        </div>

        <button
          onClick={saveRaffle}
          disabled={busy}
          className="w-full bg-green-600 text-white py-4 rounded-xl font-bold disabled:opacity-50"
        >
          {busy ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
