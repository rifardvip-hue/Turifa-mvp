// ✅ app/rifa/[slug]/page.tsx - CON UPLOAD DE IMAGEN
"use client";

import { useEffect, useRef, useState, ChangeEvent } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import TicketGrid from "@/components/TicketGrid";
import TicketStack from "@/components/TicketStack";

// Cliente de Supabase (lado cliente)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  const [ticketQuantity, setTicketQuantity] = useState<number>(1);
  const [selectedBlocks, setSelectedBlocks] = useState<number[][]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>("");

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

  const unitPrice = Number(raffle.price ?? 0) || 0;
  const total = ticketQuantity * unitPrice;

  const onCantidadChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = Number(e.target.value || 1);
    const v = Math.max(1, Math.min(10, isNaN(raw) ? 1 : raw));
    setTicketQuantity(v);
  };

  const selectedNumbers = selectedBlocks.flat();

  // 🚀 Compresión optimizada
  async function compressImage(file: File): Promise<File> {
    if (!/^image\//.test(file.type) || file.size < 300 * 1024) return file;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve(file);
      
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => resolve(file);
        
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const maxSize = 800;
            let { width, height } = img;
            
            if (width > height && width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            } else if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext("2d", { alpha: false });
            if (!ctx) {
              resolve(file);
              return;
            }
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "medium";
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob(
              (blob) => {
                if (blob && blob.size < file.size) {
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
              0.7
            );
          } catch {
            resolve(file);
          }
        };
        
        img.src = e.target?.result as string;
      };
      
      reader.readAsDataURL(file);
    });
  }

  // 🚀 Subir imagen a Supabase Storage
  async function uploadVoucher(file: File): Promise<string> {
    setUploadProgress("Comprimiendo imagen...");
    const compressed = await compressImage(file);
    
    setUploadProgress("Subiendo comprobante...");
    
    // Nombre único para evitar colisiones
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = compressed.name.split(".").pop() || "jpg";
    const fileName = `vouchers/${raffle.id}/${timestamp}-${randomStr}.${ext}`;

    const { data, error } = await supabase.storage
      .from("rifas-bucket") // 👈 Cambia esto por el nombre de tu bucket
      .upload(fileName, compressed, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      throw new Error("No se pudo subir el comprobante");
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from("rifas-bucket")
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  // 🚀 Submit optimizado
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || !raffle?.id) return;

    setSubmitting(true);
    setSuccess(false);
    setErrorMsg(null);
    setUploadProgress("");

    try {
      const formData = new FormData(e.currentTarget);

      // Validaciones
      const nombre = String(formData.get("nombre") || "").trim();
      const telefono = String(formData.get("telefono") || "").trim();
      const correo = String(formData.get("correo") || "").trim() || null;

      if (!nombre || nombre.length < 2) {
        throw new Error("El nombre debe tener al menos 2 caracteres");
      }
      if (!telefono) {
        throw new Error("El teléfono es obligatorio");
      }

      // 📤 Subir comprobante
      const voucherFile = formData.get("voucher") as File | null;
      if (!voucherFile || voucherFile.size === 0) {
        throw new Error("Debes subir un comprobante de pago");
      }

      const voucherUrl = await uploadVoucher(voucherFile);

      // 📨 Enviar reserva
      setUploadProgress("Creando reserva...");

      const payload = {
        raffle_id: raffle.id,
        nombre,
        telefono,
        correo,
        quantity: ticketQuantity,
        voucher_url: voucherUrl,
        boletos: selectedNumbers.length > 0 ? selectedNumbers : null,
        notas: null,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch("/api/orders/create-reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      // ✅ Éxito
      setSuccess(true);
      setUploadProgress("");
      formRef.current?.reset();
      setSelectedBlocks([]);
      setTicketQuantity(1);

      setTimeout(() => {
        successRef.current?.scrollIntoView({ 
          behavior: "smooth", 
          block: "center" 
        });
      }, 100);
      
    } catch (err: any) {
      console.error("Error en reserva:", err);
      
      if (err?.name === "AbortError") {
        setErrorMsg("La solicitud tardó demasiado. Verifica tu conexión e intenta de nuevo.");
      } else {
        setErrorMsg(err?.message || "Error al procesar la reserva. Intenta de nuevo.");
      }
    } finally {
      setSubmitting(false);
      setUploadProgress("");
    }
  }

  return (
    <main className="max-w-lg mx-auto p-4 space-y-6 bg-gray-50 min-h-screen pb-20">
      <img
        src={raffle.banner_url || "https://via.placeholder.com/600x300"}
        alt="Banner"
        className="w-full rounded-lg shadow-md"
        loading="lazy"
      />

      <div className="text-center">
        <h1 className="text-2xl font-bold">🎉 {raffle.title}</h1>
        <p className="text-lg text-green-600 font-semibold mt-1">🎫 RD${unitPrice}</p>
        {raffle.description && (
          <p className="text-sm mt-1 text-gray-600">{raffle.description}</p>
        )}
      </div>

      {/* Mensajes de estado */}
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
          <div className="font-semibold text-red-800 mb-1">❌ Error</div>
          <p className="text-red-700 text-sm">{errorMsg}</p>
        </div>
      )}

      {uploadProgress && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-blue-800 text-sm font-medium">{uploadProgress}</p>
          </div>
        </div>
      )}

      {/* Selección de boletos */}
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

      {/* Formulario */}
      <form ref={formRef} className="space-y-4" onSubmit={handleSubmit}>
        <input
          name="nombre"
          placeholder="Nombre completo"
          required
          disabled={submitting}
          minLength={2}
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
            Sube una foto del comprobante (máx. 5MB)
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
              {uploadProgress || "Procesando..."}
            </span>
          ) : (
            "✅ Enviar reserva"
          )}
        </button>
      </form>
    </main>
  );
}