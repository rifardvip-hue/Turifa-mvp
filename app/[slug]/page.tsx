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

  // Estados del formulario
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Refs
  const successRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    async function fetchRaffle() {
      try {
        setLoading(true);
        const res = await fetch(`/api/raffles/${slug}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        setRaffle(data?.raffle ?? null);
      } catch (e) {
        console.error("Fetch raffle error:", e);
        setRaffle(null);
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchRaffle();
  }, [slug]);

  if (loading) return <p className="text-center mt-10">Cargando...</p>;
  if (!raffle?.id) return <p className="text-center mt-10 text-red-600">Rifa no encontrada.</p>;

  // 🧮 total
  const unitPrice = Number(raffle.price ?? 0) || 0;
  const total = ticketQuantity * unitPrice;

  // manejar input de cantidad (1..10)
  const onCantidadChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = Number(e.target.value || 1);
    const v = Math.max(1, Math.min(10, isNaN(raw) ? 1 : raw));
    setTicketQuantity(v);
  };

  // lista plana de números seleccionados
  const selectedNumbers = selectedBlocks.flat();

  // Comprimir imagen si pesa > 500KB
  async function compressImage(file: File): Promise<File> {
    if (!/^image\//.test(file.type) || file.size < 500 * 1024) return file;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxWidth = 1200;
          const scale = Math.min(1, maxWidth / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(
                  new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  })
                );
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            0.8
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  // Submit
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    // Guardia adicional por seguridad (además del render-guard)
    if (!raffle?.id) {
      setErrorMsg("No se pudo cargar la rifa. Recarga la página e inténtalo de nuevo.");
      return;
    }

    setSubmitting(true);
    setSuccess(false);
    setErrorMsg(null);

    try {
      const formData = new FormData(e.currentTarget);

      // Validaciones básicas
      const nombre = String(formData.get("nombre") || "").trim();
      const telefono = String(formData.get("telefono") || "").trim();
      if (!nombre || !telefono) {
        throw new Error("Nombre y teléfono son obligatorios.");
      }

      // Comprimir imagen si existe
      const voucherFile = formData.get("voucher") as File | null;
      if (voucherFile && voucherFile.size > 0) {
        const compressed = await compressImage(voucherFile);
        formData.set("voucher", compressed);
      }

      // Metadata obligatoria
      formData.set("raffle_id", raffle.id);
      formData.set("slug", slug);
      formData.set("quantity", String(ticketQuantity));
      if (selectedNumbers.length > 0) {
        formData.set("selected_digits", JSON.stringify(selectedNumbers));
      }

      // Enviar con timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      const response = await fetch("/api/orders/create-reservation", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      // Éxito
      setSuccess(true);
      formRef.current?.reset();
      setSelectedBlocks([]);
      setTicketQuantity(1);

      setTimeout(() => {
        successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } catch (err: any) {
      console.error("Error en reserva:", err);
      setErrorMsg(
        err?.name === "AbortError"
          ? "La solicitud tardó demasiado. Por favor intenta de nuevo."
          : err?.message || "Error al enviar la reserva. Intenta de nuevo."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto p-4 space-y-6 bg-gray-50 min-h-screen pb-20">
      <img
        src={raffle.banner_url || "https://via.placeholder.com/600x300"}
        alt="Banner"
        className="w-full rounded-lg shadow-md"
      />

      <div className="text-center">
        <h1 className="text-2xl font-bold">🎉 {raffle.title}</h1>
        <p className="text-lg text-green-600 font-semibold mt-1">🎫 RD${unitPrice}</p>
        {raffle.description && (
          <p className="text-sm mt-1 text-gray-600">{raffle.description}</p>
        )}
      </div>

      {/* ---------- Mensajes de estado ---------- */}
      {success && (
        <div
          ref={successRef}
          className="rounded-xl border-2 border-green-500 bg-green-50 p-6 shadow-lg animate-pulse"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-white text-2xl">✓</span>
            </div>
            <div>
              <div className="font-bold text-green-800 text-lg">¡Reserva enviada!</div>
              <p className="text-green-700 text-sm">
                Tu solicitud fue recibida exitosamente
              </p>
            </div>
          </div>
          <div className="bg-green-100 rounded-lg p-4 mt-3">
            <p className="text-green-800 text-sm">
              ⏳ <strong>Estamos validando tu pago.</strong> En breve recibirás la
              confirmación de tus boletos por WhatsApp y correo electrónico.
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4">
          <div className="font-semibold text-red-800 mb-1">❌ Error al enviar</div>
          <p className="text-red-700 text-sm">{errorMsg}</p>
        </div>
      )}

      {/* ---------- Selección de boletos ---------- */}
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

      {/* ---------- Formulario ---------- */}
      <form ref={formRef} className="space-y-4" onSubmit={handleSubmit}>
        <input
          name="nombre"
          placeholder="Nombre completo"
          required
          disabled={submitting}
          className="w-full border p-3 rounded-md disabled:opacity-50 disabled:bg-gray-100"
          autoComplete="name"
        />
        <input
          name="telefono"
          placeholder="Teléfono (WhatsApp)"
          required
          disabled={submitting}
          className="w-full border p-3 rounded-md disabled:opacity-50 disabled:bg-gray-100"
          inputMode="tel"
          autoComplete="tel"
        />
        <input
          name="correo"
          placeholder="Correo electrónico (opcional)"
          type="email"
          disabled={submitting}
          className="w-full border p-3 rounded-md disabled:opacity-50 disabled:bg-gray-100"
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
              disabled={submitting}
              required
              className="w-full border p-3 rounded-md disabled:opacity-50 disabled:bg-gray-100"
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

        <div>
          <label className="block text-sm font-medium mb-2">
            Comprobante de pago
          </label>
          <input
            type="file"
            name="voucher"
            accept="image/*"
            required
            disabled={submitting}
            className="w-full disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 mt-1">
            Sube una foto o captura del comprobante
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || !raffle?.id}
          className="w-full bg-green-600 text-white text-xl py-4 rounded-md hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all font-bold shadow-lg"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Reservando...
            </span>
          ) : (
            "✅ Enviar reserva"
          )}
        </button>
      </form>
    </main>
  );
}
