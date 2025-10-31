"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

type MediaItem = {
  id: string;
  type: "image" | "video";
  url: string;
  order: number;
};

type Raffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  banner_url?: string | null; // ← agregado para permitir r.banner_url
  media: {
    banner?: string | null;
    gallery: MediaItem[];
  };
};

export default function EditRafflePage() {
  const { id } = useParams<{ id: string }>(); // ⚠️ esta página debe ser /admin/rifas/[id]/edit
  const router = useRouter();
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRaffle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRaffle() {
    // ✅ Usa la ruta admin por ID (tu GET ya la soporta y devuelve media.banner + gallery)
    const res = await fetch(`/api/admin/rifas/${id}`, { cache: "no-store" });
    const json = await res.json();
    if (json?.ok && json.raffle) {
      const r = json.raffle as Raffle;
      setRaffle({
        ...r,
        media: {
          banner: r.media?.banner ?? r.banner_url ?? null,
          gallery: Array.isArray(r.media?.gallery) ? r.media.gallery : [],
        },
      });
    }
    setLoading(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !raffle) return;

    setUploading(true);
    try {
      const nextIndex = raffle.media.gallery.length;
      const galleryAdds: MediaItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        // (opcional) pasar raffleId para que tu API lo suba a una carpeta de ese slug/id
        formData.append("raffle_id", raffle.id);

        const res = await fetch("/api/upload/media", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (data?.ok && data.url) {
          const type: "image" | "video" = file.type.startsWith("video/")
            ? "video"
            : "image";
          galleryAdds.push({
            id: `p_${crypto.randomUUID()}`,
            type,
            url: data.url,
            order: nextIndex + i,
          });
        }
      }

      setRaffle((prev) =>
        prev
          ? {
              ...prev,
              media: {
                ...prev.media,
                gallery: [...prev.media.gallery, ...galleryAdds],
              },
            }
          : prev
      );
    } catch (err) {
      console.error(err);
      alert("Error al subir archivos");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeMedia(mid: string) {
    if (!raffle) return;
    const newGallery = raffle.media.gallery.filter((m) => m.id !== mid);
    newGallery.forEach((m, i) => (m.order = i));
    setRaffle({ ...raffle, media: { ...raffle.media, gallery: newGallery } });
  }

  function moveMedia(index: number, direction: "up" | "down") {
    if (!raffle) return;
    const newGallery = [...raffle.media.gallery];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newGallery.length) return;
    [newGallery[index], newGallery[target]] = [newGallery[target], newGallery[index]];
    newGallery.forEach((m, i) => (m.order = i));
    setRaffle({ ...raffle, media: { ...raffle.media, gallery: newGallery } });
  }

  async function saveRaffle() {
    if (!raffle) return;
    try {
      const res = await fetch(`/api/admin/rifas/${raffle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: raffle.title,
          description: raffle.description,
          media: {
            banner: raffle.media.banner ?? null,
            gallery: raffle.media.gallery.map((g) => ({
              id: g.id,
              type: g.type,
              url: g.url,
              order: g.order ?? 0,
            })),
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        console.error("Save error:", json);
        alert("Error al guardar la rifa.");
        return;
      }

      alert("Rifa actualizada correctamente");
      router.push("/admin/rifas");
    } catch (err) {
      console.error(err);
      alert("Error al guardar");
    }
  }

  if (loading) return <p>Cargando...</p>;
  if (!raffle) return <p>Rifa no encontrada</p>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">Editar Rifa: {raffle.title}</h1>
          <button
            onClick={saveRaffle}
            className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600"
          >
            Guardar cambios
          </button>
        </header>

        {/* Subir imágenes */}
        <div className="bg-gray-800 rounded-xl p-4">
          <label className="block text-sm text-gray-300 mb-2">Añadir imágenes / videos</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-100"
          />
          {uploading && <p className="text-sm text-gray-400 mt-2">Subiendo...</p>}
        </div>

        {/* Galería actual */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="text-sm text-gray-300 mb-3">Galería ({raffle.media.gallery.length})</h2>
          {raffle.media.gallery.length === 0 ? (
            <p className="text-gray-400 text-sm">Aún no hay imágenes.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {raffle.media.gallery
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((m, idx) => (
                  <div key={m.id} className="relative group">
                    {m.type === "video" ? (
                      <video src={m.url} controls className="rounded-lg w-full" />
                    ) : (
                      <img src={m.url} alt="" className="rounded-lg w-full object-cover" />
                    )}
                    <div className="absolute inset-x-0 -bottom-2 flex gap-2 justify-center opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => moveMedia(idx, "up")}
                        className="px-2 py-1 text-xs bg-gray-700 rounded"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveMedia(idx, "down")}
                        className="px-2 py-1 text-xs bg-gray-700 rounded"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeMedia(m.id)}
                        className="px-2 py-1 text-xs bg-red-600 rounded"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
