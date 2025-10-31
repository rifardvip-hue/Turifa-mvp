"use client";
import { useRef, useState } from "react";

type Props = {
  raffleId: string;
  initialBanner?: string | null;
  onChange?: (newUrl: string) => void; // opcional: para levantar estado al padre
};

export default function BannerUploader({ raffleId, initialBanner = null, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(initialBanner);
  const [uploading, setUploading] = useState(false);

  async function handlePick() {
    fileRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/rifas/${raffleId}/banner`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "No se pudo subir el banner");
      }
      setBannerUrl(json.banner_url);
      onChange?.(json.banner_url);
      alert("Banner actualizado ✅");
    } catch (e: any) {
      alert(e?.message || "Error subiendo el banner");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl border border-gray-700/60 bg-[#0b0f16] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">Banner</h3>
        <button
          type="button"
          onClick={handlePick}
          disabled={uploading}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white font-semibold disabled:opacity-60"
        >
          {uploading ? "Subiendo…" : "Subir banner"}
        </button>
      </div>

      {bannerUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-gray-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bannerUrl} alt="Banner actual" className="w-full h-48 object-cover" />
          <div className="absolute top-2 right-2 text-xs bg-black/70 text-white px-2 py-1 rounded">
            Banner actual
          </div>
        </div>
      ) : (
        <div className="h-48 grid place-items-center rounded-xl border border-dashed border-gray-700 text-gray-400">
          Sin banner
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <p className="mt-2 text-xs text-gray-400">
        Recomendado: JPG/PNG en horizontal (≥ 1600px ancho). El archivo se guarda en Storage y se refleja en
        <code className="mx-1 px-1 rounded bg-black/40">raffle_media(order = -1)</code>.
      </p>
    </div>
  );
}
