// ✅ app/rifa/[slug]/page.tsx
"use client";

import { useEffect, useRef, useState, ChangeEvent } from "react";
import { useParams } from "next/navigation";
import TicketGrid from "@/components/TicketGrid";
import TicketStack from "@/components/TicketStack";

type Raffle = {
  id: string;
  title: string;
  description?: string;
  price: number | string;
  banner_url?: string;
  bank_name?: string;
  bank_account?: string;
  bank_holder?: string;
};

export default function RifaSlugPage() {
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔢 cantidad y selección de números
  const [ticketQuantity, setTicketQuantity] = useState<number>(1);
  const [selectedBlocks, setSelectedBlocks] = useState<number[][]>([]);
  const selectedNumbers = selectedBlocks.flat();

  // 📨 envío
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<null | { name: string }>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const successRef = useRef<HTMLDivElement>(null);

  // ⚠️ ajusta si tu endpoint de reserva es otro
  const RESERVE_URL = "/api/orders";

  useEffect(() => {
    async function fetchRaffle() {
      try {
        const res = await fetch(`/api/raffles/${slug}`, { cache: "no-store" });
        const data = await res.json();
        setRaffle(data?.raffle ?? null);
      } catch {
        setRaffle(null);
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchRaffle();
  }, [slug]);

  // 🔥 “warm up” funciones/lambdas para evitar cold start al enviar
  useEffect(() => {
    fetch("/api/ping", { cache: "no-store" }).catch(() => {});
  }, []);

  if (loading) return <p className="text-center mt-10">Cargando...</p>;
  if (!raffle?.id)
    return (
      <p className="text-center mt-10 text-red-600">Rifa no encontrada.</p>
    );

  // 🧮 total
  const unitPrice = Number(raffle.price || 0);
  const total = ticketQuantity * unitPrice;

  // manejar input de cantidad (1..10)
  const onCantidadChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = Number(e.target.value || 1);
    const v = Math.max(1, Math.min(10, isNaN(raw) ? 1 : raw));
    setTicketQuantity(v);
  };

  // --- util: comprimir imagen del voucher para acelerar subida ---
  async function compressImage(
    file: File,
    {
      maxWidth = 1600,
      maxBytes = 600 * 1024, // 600 KB
      qualityStart = 0.85,
    }: { maxWidth?: number; maxBytes?: number; qualityStart?: number } = {}
  ): Promise<File> {
    if (!/^image\//.test(file.type)) return file;
    const img = document.createElement("img");
    const url = URL.createObjectURL(file);
    await new Promise<void>((ok, err) => {
      img.onload = () => ok();
      img.onerror = () => err(new Error("No se pudo leer la imagen"));
      img.src = url;
    });

    const scale = Math.min(1, maxWidth / (img.naturalWidth || maxWidth));
    const w = Math.max(1, Math.round((img.naturalWidth || maxWidth) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || maxWidth) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);

    URL.revokeObjectURL(url);

    let quality = qualityStart;
    let blob: Blob | null = null;

    // intenta varias calidades hasta quedar < maxBytes (límite mínimo 0.5)
    for (let i = 0; i < 6; i++) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(
          (b) => resolve(b),
          "image/jpeg",
          Math.max(0.5, quality)
        )
      );
      if (!blob) break;
      if (blob.size <= maxBytes) break;
      quality -= 0.1;
    }

    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  }

  // --- envío controlado ---
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const fd = new FormData(e.currentTarget);

      // normalizar campos
      const nombre = String(fd.get("nombre") || "").trim();
      const telefono = String(fd.get("telefono") || "").trim();
      const correo = String(fd.get("correo") || "").trim();
      const cantidad = Number(fd.get("cantidad") || ticketQuantity) || 1;

      if (!nombre || !telefono) {
        setErrorMsg("Nombre y teléfono son obligatorios.");
        setSubmitting(false);
        return;
        }

      // comprimir voucher (si viene)
      const voucherFile = fd.get("voucher");
      if (voucherFile instanceof File && voucherFile.size > 0) {
        const optimized = await compressImage(voucherFile);
        fd.set("voucher", optimized);
      }

      // incluir metadatos que tu backend suele esperar
      fd.set("raffle_id", raffle.id);
      fd.set("slug", slug);
      fd.set("quantity", String(cantidad));

      // si ya tienes números elegidos en la UI, los mandamos también (opcional)
      if (selectedNumbers.length > 0) {
        fd.set("selected_digits", JSON.stringify(selectedNumbers));
      }

      // envío (usa keepalive para no cortar si el tab se cierra)
      const res = await fetch(RESERVE_URL, {
        method: "POST",
        body: fd,
        keepalive: true,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error ${res.status}`);
      }

      // opcional: leer respuesta
      // const json = await res.json().catch(() => ({}));

      // éxito visual
      setSuccess({ name: nombre });

      // esperar al render y centrar el banner
      requestAnimationFrame(() => {
        successRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });

      // limpiar el form (no tocamos tu selección de números)
      e.currentTarget.reset();
    } catch (err: any) {
      setErrorMsg(
        err?.message?.slice(0, 200) ||
          "Hubo un problema al enviar tu reserva. Intenta de nuevo."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto p-4 space-y-6 bg-gray-50 min-h-screen">
      <img
        src={raffle.banner_url || "https://via.placeholder.com/600x300"}
        alt="Banner"
        className="w-full rounded-lg shadow-md"
      />

      <div className="text-center">
        <h1 className="text-2xl font-bold">🎉 {raffle.title}</h1>
        <p className="text-lg text-green-600 font-semibold mt-1">
          🎫 RD${unitPrice}
        </p>
        {raffle.description && (
          <p className="text-sm mt-1 text-gray-600">{raffle.description}</p>
        )}
      </div>

      {/* ---------- Bloque de selección y visualización de boletos ---------- */}
      <section className="space-y-3">
        <h2 className="text-center font-semibold">Tus boletos</h2>

        <TicketGrid
          raffleId={raffle.id}
          quantity={ticketQuantity}
          price={unitPrice}
          onChange={setSelectedBlocks}
        />

        <div className="mt-2 flex justify-center">
          {selectedNumbers.length > 0 ? (
            <TicketStack
              tickets={selectedNumbers}
              title={raffle.title}
              priceLabel={`RD$${unitPrice}`}
            />
          ) : (
            <TicketStack
              amount={ticketQuantity}
              title={raffle.title}
              priceLabel={`RD$${unitPrice}`}
            />
          )}
        </div>
      </section>

      {/* ---------- Mensajes de estado ---------- */}
      {success && (
        <div
          ref={successRef}
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
        >
          <div className="font-semibold text-emerald-800">
            ¡Reserva enviada exitosamente!
          </div>
          <p className="text-emerald-700 text-sm mt-1">
            Gracias {success.name}. Estamos validando tu pago. En breve recibirás
            la confirmación de tus boletos por WhatsApp y correo.
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="font-semibold text-rose-800">No se pudo enviar</div>
          <p className="text-rose-700 text-sm mt-1">{errorMsg}</p>
        </div>
      )}

      {/* ---------- Formulario ---------- */}
      <form className="space-y-4" onSubmit={onSubmit}>
        <input
          name="nombre"
          placeholder="Nombre completo"
          required
          className="w-full border p-3 rounded-md"
          autoComplete="name"
        />
        <input
          name="telefono"
          placeholder="Teléfono (WhatsApp)"
          required
          className="w-full border p-3 rounded-md"
          inputMode="tel"
          autoComplete="tel"
        />
        <input
          name="correo"
          placeholder="Correo electrónico"
          className="w-full border p-3 rounded-md"
          type="email"
          autoComplete="email"
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">
              Cantidad de boletos
            </label>
            <input
              name="cantidad"
              type="number"
              min={1}
              max={10}
              value={ticketQuantity}
              onChange={onCantidadChange}
              required
              className="w-full border p-3 rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              Total estimado: <strong>RD${total}</strong>
            </p>
          </div>
        </div>

        <div className="bg-gray-100 p-3 rounded-md text-sm">
          <p className="font-semibold mb-1">Instrucciones de pago:</p>
          <p>
            <strong>Banco:</strong> {raffle.bank_name ?? "—"}
          </p>
          <p>
            <strong>Cuenta:</strong> {raffle.bank_account ?? "—"}
          </p>
          <p>
            <strong>Nombre:</strong> {raffle.bank_holder ?? "—"}
          </p>
        </div>

        <input
          type="file"
          name="voucher"
          accept="image/*"
          required
          className="w-full"
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-green-600 text-white text-xl py-3 rounded-md hover:bg-green-700 disabled:opacity-60"
        >
          {submitting ? "⏳ Reservando..." : "✅ Enviar reserva"}
        </button>
      </form>
    </main>
  );
}
