"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import TicketFinder from "@/components/TicketFinder";

/* ======================
   Tipos / utilidades
   ====================== */
type VerifiedTicket = { digits: string; verified: true };

type GalleryItem = { id: string; type: "image" | "video"; url: string; order: number };

type BankInstitution = {
  id: string;
  method: "transfer" | "zelle" | "card";
  name: string;
  account?: string | null;
  holder?: string | null;
  logo_url?: string | null;
  extra?: string | null;
  order?: number | null;
};

type RaffleResp = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  price: number;
  bank_instructions?: string | null;
  banner_url?: string | null;
  media?:
    | {
        banner?: string | null;
        gallery?: GalleryItem[];
        logos?: { transfer?: string | null; zelle?: string | null; card?: string | null } | null;
      }
    | null;

  bank_institutions?: BankInstitution[] | null;
};

function parseBank(instr?: string | null) {
  if (!instr) return { bank_name: "", bank_account: "", bank_holder: "" };
  const name = instr.match(/Banco\s*:?\s*(.*)/i)?.[1]?.trim() ?? "";
  const account = instr.match(/Cuenta\s*:?\s*(.*)/i)?.[1]?.trim() ?? "";
  const holder = instr.match(/Nombre\s*:?\s*(.*)/i)?.[1]?.trim() ?? "";
  return { bank_name: name, bank_account: account, bank_holder: holder };
}

// RD $2,000 (sin decimales)
function formatRD(n: number) {
  const parts = Math.round(n).toString().split("").reverse();
  const withSep: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    withSep.push(parts[i]);
    if ((i + 1) % 3 === 0 && i + 1 < parts.length) withSep.push(",");
  }
  return `RD $${withSep.reverse().join("")}`;
}

/** Color de marca para el anillo/gradiente del tile activo */
function brandColor(name: string): { ring: string; softBg: string } {
  const n = (name || "").toLowerCase();
  if (n.includes("bhd")) return { ring: "ring-green-500", softBg: "from-green-900/40 to-emerald-900/30" };
  if (n.includes("banreservas") || n.includes("reservas"))
    return { ring: "ring-blue-500", softBg: "from-blue-900/40 to-indigo-900/30" };
  if (n.includes("popular")) return { ring: "ring-blue-400", softBg: "from-blue-800/40 to-sky-900/30" };
  if (n.includes("alaver")) return { ring: "ring-amber-500", softBg: "from-amber-900/40 to-orange-900/30" };
  if (n.includes("scotia")) return { ring: "ring-red-500", softBg: "from-red-900/40 to-rose-900/30" };
  return { ring: "ring-orange-500", softBg: "from-orange-900/40 to-amber-900/30" };
}

/* ====== helpers extras pedidas ====== */
// (809)-601-0199
function formatPhoneRD(input: string) {
  const d = (input || "").replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)})-${d.slice(3)}`;
  return `(${d.slice(0, 3)})-${d.slice(3, 6)}-${d.slice(6)}`;
}
function cleanEmail(s: string) {
  return (s || "").trim().replace(/\s+/g, "");
}
function isValidEmailDotCom(s: string) {
  const v = cleanEmail(s);
  return /^[^\s@]+@[^\s@]+\.com$/i.test(v);
}

/* ======================
   Helper: fetch por SLUG (y fallback por ID)
   ====================== */
async function fetchPublicBySlug(slug: string) {
  const timestamp = Date.now();
  
  const tries = [
    `/api/rifas/by-slug/${encodeURIComponent(slug)}?_t=${timestamp}`,
    `/api/raffles/by-slug/${encodeURIComponent(slug)}?_t=${timestamp}`,
  ];
  
  for (const url of tries) {
    try {
      console.log(`🔎 Intentando fetch desde: ${url}`);
      const res = await fetch(url, { 
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      });
      
      if (!res.ok) {
        console.warn(`⚠️ ${url} respondió con status ${res.status}`);
        continue;
      }
      
      const data = await res.json();
      
      if (data?.ok && data?.raffle) {
        console.log(`✅ Datos cargados exitosamente desde: ${url}`);
        console.log(`💰 PRECIO DESDE API:`, data.raffle.price);
        return data.raffle;
      }
    } catch (err) {
      console.error(`❌ Error en ${url}:`, err);
    }
  }
  
  console.error("❌ No se pudo cargar la rifa desde ningún endpoint");
  return null;
}

/* ====== helper: intenta varias rutas y devuelve la primera OK ====== */
async function fetchJSONWithFallback(urls: string[]) {
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json().catch(() => null);
      if (j) return j;
    } catch {}
  }
  return null;
}

/* ======================
   Página
   ====================== */
export default function RifaSlugPage() {
  const params = useParams<{ slug?: string | string[] }>();
  const slug = Array.isArray(params?.slug) ? params!.slug[0] : params?.slug;

  const [raffle, setRaffle] = useState<RaffleResp | null>(null);
  const [loading, setLoading] = useState(true);
  const successRef = useRef<HTMLDivElement>(null);

  // UI / compra
  const [ticketQuantity, setTicketQuantity] = useState<number>(1);
  const [orderPending, setOrderPending] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [verifiedTickets, setVerifiedTickets] = useState<VerifiedTicket[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Estados para mensajes de estado
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Archivos
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Búsqueda (un solo cuadro)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<null | { found: boolean; message: string }>(null);

  // Carrusel
  const [active, setActive] = useState(0);

  // Modal descripción
  const [showDesc, setShowDesc] = useState(false);

  // Modal para galería
  const [modalMedia, setModalMedia] = useState<GalleryItem | null>(null);

  // Datos del participante (sin cédula)
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");

  /** Índice de institución seleccionada (solo transfer) */
  const [instIndex, setInstIndex] = useState<{ transfer: number }>({ transfer: 0 });

  /* 1) Cargar rifa */
  useEffect(() => {
    let alive = true;
    
    (async () => {
      try {
        if (!slug) {
          setRaffle(null);
          setLoading(false);
          return;
        }

        console.log("🔍 Buscando rifa con slug:", slug);

        const r = await fetchPublicBySlug(slug);
        if (!alive) return;

        console.log("🎯 Resultado completo de fetchPublicBySlug:", r);
        
        if (!r) {
          console.error("❌ No se encontró la rifa");
          setRaffle(null);
          setLoading(false);
          return;
        }

        // --- Extraer galería directamente del resultado ---
        let gallery: GalleryItem[] = [];
        
        // Si ya viene con media.gallery desde el endpoint
        if (r.media?.gallery && Array.isArray(r.media.gallery)) {
          gallery = r.media.gallery;
          console.log("✅ Galería extraída directamente:", gallery);
        }

        // Ordena por 'order'
        gallery = gallery.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const banner = r?.media?.banner ?? r?.banner_url ?? null;
        console.log("🖼️ Banner URL:", banner);
        console.log("📸 Galería final:", gallery);

        // Instituciones bancarias ordenadas
        const institutions: BankInstitution[] = Array.isArray(r.bank_institutions)
          ? r.bank_institutions
          : [];
        institutions.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
        
        console.log("🏦 Instituciones bancarias:", institutions);

        // Actualiza el estado
        setRaffle({
          ...r,
          media: { 
            banner, 
            gallery, 
            logos: r?.media?.logos ?? null 
          },
          banner_url: banner ?? undefined,
          bank_institutions: institutions,
        });

        // Selecciona la primera institución de transferencia
        const firstTransferIdx = institutions.findIndex((b) => b.method === "transfer");
        if (firstTransferIdx >= 0) {
          setInstIndex({ transfer: firstTransferIdx });
        }

        setActive(0);
        setLoading(false);
        
        console.log("✅ Estado de la rifa actualizado correctamente");

      } catch (err) {
        console.error("❌ Error general cargando la rifa:", err);
        setRaffle(null);
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  /* Polling verificación de pago */
  useEffect(() => {
    if (!orderPending || !paymentId) return;
    let n = 0;
    const max = 75;
    const timer = setInterval(async () => {
      n++;
      try {
        const res = await fetch(`/api/orders/check?payment_id=${paymentId}`);
        const json = await res.json().catch(() => null);
        if (json?.ok && json?.verified && Array.isArray(json?.tickets)) {
          const list: VerifiedTicket[] = json.tickets
            .filter((t: any) => typeof t?.digits === "string" && /^[1-9]{4}$/.test(t.digits))
            .map((t: any) => ({ digits: t.digits, verified: true as const }));
          if (list.length > 0) {
            setVerifiedTickets(list);
            setOrderPending(false);
            clearInterval(timer);
          }
        }
      } catch {}
      if (n >= max) clearInterval(timer);
    }, 4000);
    return () => clearInterval(timer);
  }, [orderPending, paymentId]);

// Solo la función handleSubmit modificada - reemplaza la función completa

async function handleSubmit() {
  if (!raffle?.id) return;
  if (!acceptedTerms) return alert("Debes aceptar los términos y condiciones.");
  if (!selectedFile) return alert("Por favor adjunta la imagen del comprobante.");
  if (!nombre.trim() || !telefono.trim()) return alert("Por favor completa nombre y teléfono.");

  // Validación de email .com si viene
  if (correo.trim()) {
    const cleaned = cleanEmail(correo);
    if (!isValidEmailDotCom(cleaned)) {
      return alert("Ingresa un email válido que termine en .com");
    }
  }

  const transferInstitutions = (raffle.bank_institutions ?? []).filter((b) => b.method === "transfer");
  const safeIndex = Math.min(Math.max(0, instIndex.transfer), Math.max(0, transferInstitutions.length - 1));
  const chosen = transferInstitutions[safeIndex];

  setIsSubmitting(true);
  setSubmitSuccess(false);

 try {
    // Comprimir la imagen primero
    const compressedFile = await compressImageSimple(selectedFile);
    
    console.log(`📦 Original: ${(selectedFile.size / 1024).toFixed(0)}KB → Comprimido: ${(compressedFile.size / 1024).toFixed(0)}KB`);

    // Verificar tamaño después de comprimir
    if (compressedFile.size > 3 * 1024 * 1024) {
      setIsSubmitting(false);
      return alert("La imagen sigue siendo muy grande después de comprimir. Por favor toma una foto de menor calidad.");
    }

    // Subir
    const up = new FormData();
    up.append("file", compressedFile);
    
    const resUp = await fetch("/api/upload/voucher", { 
      method: "POST", 
      body: up 
    });
    const upJson = await resUp.json();
    
    if (!resUp.ok || !upJson?.ok) {
      setIsSubmitting(false);
      return alert(upJson?.error || "Error al subir el comprobante.");
    }

    const { url: voucher_url, payment_id } = upJson;
    setPaymentId(payment_id || null);

    // 2. Crear reserva
    const payload = {
      raffle_id: raffle.id,
      nombre,
      telefono,
      correo: cleanEmail(correo),
      pay_method: "transfer",
      boletos: Array.from({ length: ticketQuantity }, (_, i) => i + 1),
      payment_id,
      voucher_url,
      slug,
      quantity: ticketQuantity,
      bank_institution_id: chosen?.id ?? null,
    };

    const resR = await fetch("/api/orders/create-reservation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const rJson = await resR.json().catch(() => null);
    
    if (!resR.ok || !rJson?.ok) {
      setIsSubmitting(false);
      return alert("Error al enviar la reserva.");
    }

    // 3. Éxito inmediato - resetear todo
    setIsSubmitting(false);
    setSubmitSuccess(true);
    
    // Limpiar formulario
    setNombre("");
    setTelefono("");
    setCorreo("");
    setSelectedFile(null);
    setAcceptedTerms(false);
    setTicketQuantity(1);
    
    // Desplazar suavemente hacia el mensaje de éxito
    setTimeout(() => {
      successRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 200);

    // Ocultar el mensaje después de 30 segundos
    setTimeout(() => {
      setSubmitSuccess(false);
    }, 30000);
    
  } catch (error) {
    console.error("Error en handleSubmit:", error);
    setIsSubmitting(false);
    alert("Error inesperado. Intenta nuevamente.");
  }
}

  /* Búsqueda unificada (tel / email / 4 dígitos) con fallbacks para evitar 404 */
  async function handleUnifiedSearch() {
    if (!raffle?.id) return;
    setSearchResult(null);

    const raw = (searchQuery || "").trim();
    if (!raw) return setSearchResult({ found: false, message: "Escribe algo para buscar." });

    // 1) ¿4 dígitos? -> tickets
    if (/^[1-9]{4}$/.test(raw)) {
      try {
        const json =
          (await fetchJSONWithFallback([
            `/api/tickets/find?raffle=${raffle.id}&digits=${raw}`,
            `/api/ticket/find?raffle=${raffle.id}&digits=${raw}`,
          ])) || null;

        if (!json?.ok) return setSearchResult({ found: false, message: "No pudimos buscar el boleto." });

        if (json.found) {
          if (json.verified) {
            setVerifiedTickets([{ digits: raw, verified: true }]);
            setOrderPending(false);
            return setSearchResult({ found: true, message: "Boleto verificado ✅" });
          }
          return setSearchResult({ found: true, message: "Boleto encontrado pero aún no verificado." });
        }
        return setSearchResult({ found: false, message: "No encontramos ese boleto." });
      } catch {
        return setSearchResult({ found: false, message: "Error buscando el boleto." });
      }
    }

    // 2) ¿email .com?
    const maybeEmail = cleanEmail(raw);
    if (isValidEmailDotCom(maybeEmail)) {
      try {
        const json =
          (await fetchJSONWithFallback([
            `/api/orders/find-by-email?raffle=${raffle.id}&email=${encodeURIComponent(maybeEmail)}`,
            `/api/orders/findByEmail?raffle=${raffle.id}&email=${encodeURIComponent(maybeEmail)}`,
            `/api/orders/find?type=email&raffle=${raffle.id}&q=${encodeURIComponent(maybeEmail)}`,
          ])) || null;

        if (!json?.ok)
          return setSearchResult({ found: false, message: "No pudimos buscar por email." });

        if (Array.isArray(json.tickets) && json.tickets.length > 0) {
          const list = json.tickets
            .filter((t: any) => /^[1-9]{4}$/.test(t?.digits))
            .map((t: any) => ({ digits: t.digits, verified: true as const }));
          setVerifiedTickets(list);
          setOrderPending(false);
          return setSearchResult({ found: true, message: `Encontramos ${list.length} boleto(s) verificado(s).` });
        } else if (json.found_pending) {
          return setSearchResult({ found: true, message: "Encontramos órdenes, pero aún sin verificar." });
        }
        return setSearchResult({ found: false, message: "No encontramos boletos para ese email." });
      } catch {
        return setSearchResult({ found: false, message: "Error buscando por email." });
      }
    }

    // 3) si no, lo tratamos como teléfono
    try {
      const json =
        (await fetchJSONWithFallback([
          `/api/orders/find-by-phone?raffle=${raffle.id}&phone=${encodeURIComponent(raw)}`,
          `/api/orders/findByPhone?raffle=${raffle.id}&phone=${encodeURIComponent(raw)}`,
          `/api/orders/find?type=phone&raffle=${raffle.id}&q=${encodeURIComponent(raw)}`,
        ])) || null;

      if (!json?.ok)
        return setSearchResult({ found: false, message: "No pudimos buscar por teléfono." });

      if (Array.isArray(json.tickets) && json.tickets.length > 0) {
        const list = json.tickets
          .filter((t: any) => /^[1-9]{4}$/.test(t?.digits))
          .map((t: any) => ({ digits: t.digits, verified: true as const }));
        setVerifiedTickets(list);
        setOrderPending(false);
        return setSearchResult({ found: true, message: `Encontramos ${list.length} boleto(s) verificado(s).` });
      } else if (json.found_pending) {
        return setSearchResult({ found: true, message: "Encontramos órdenes, pero aún sin verificar." });
      }
      return setSearchResult({ found: false, message: "No encontramos boletos para ese teléfono." });
    } catch {
      return setSearchResult({ found: false, message: "Error buscando por teléfono." });
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  }

  /* Loading / Not found */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-t-4 border-orange-500"></div>
          <p className="mt-4 text-gray-300 text-lg">Cargando rifa...</p>
        </div>
      </div>
    );
  }

  if (!raffle?.id) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6">
        <h1 className="text-2xl font-bold text-white mb-4">
          Participa dejando tus datos
        </h1>
        <form className="space-y-4 max-w-md">
          <input className="w-full px-4 py-3 rounded bg-black/40 border border-gray-700 text-white" placeholder="Nombre" />
          <input className="w-full px-4 py-3 rounded bg-black/40 border border-gray-700 text-white" placeholder="Teléfono" />
          <input className="w-full px-4 py-3 rounded bg-black/40 border border-gray-700 text-white" placeholder="Email" />
          <button className="w-full py-3 rounded bg-orange-600 text-white font-bold">Enviar</button>
        </form>
      </main>
    );
  }

  console.log("✅ Banner URL:", raffle.media?.banner || raffle.banner_url);
  console.log("🖼️ Galería:", raffle.media?.gallery);

  /* Datos derivados */
  const bannerUrl = raffle.media?.banner || raffle.banner_url || "/banner-raffle.jpg";

  const heroList: GalleryItem[] = (() => {
    const g = raffle.media?.gallery ?? [];
    return [...g].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  })();

  const current = heroList[active];
  const price = Number(raffle.price ?? 0);
  const total = ticketQuantity * price;

  const { bank_name, bank_account, bank_holder } = parseBank(raffle.bank_instructions);

  /** Instituciones (solo transferencia) y selección actual */
  const transferInstitutions = (raffle.bank_institutions ?? []).filter((b) => b.method === "transfer");
  const safeIndex = Math.min(Math.max(0, instIndex.transfer), Math.max(0, transferInstitutions.length - 1));
  const currentInstitution = transferInstitutions[safeIndex];
  const activeBrand = currentInstitution ? brandColor(currentInstitution.name || "") : brandColor("");

  // ---- helpers onError para evitar loops de carga ----
  const safeImgOnError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "1";
    img.src = "/img-fallback.png";
    img.classList.add("opacity-40");
  };

  const safeVideoOnError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.dataset.fallbackApplied) return;
    v.dataset.fallbackApplied = "1";
    v.poster = "/video-fallback.png";
    v.classList.add("opacity-40");
  };

  /* Render */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Header con precio por ticket */}
      <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-orange-500/20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider">{raffle.title}</h1>
          <div className="text-right">
            <div className="text-xs text-gray-400 uppercase">Precio por ticket</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-orange-400">{formatRD(price)}</div>
          </div>
        </div>
      </div>

      {/* Banner con marco bonito */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-orange-500/30">
          <img
            src={bannerUrl}
            alt="Banner"
            className="w-full h-[280px] sm:h-[400px] object-cover"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (img.dataset.fallbackApplied) return;
              img.dataset.fallbackApplied = "1";
              img.src = "/img-fallback.png";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
        </div>
      </div>

      {/* Galería con modal al hacer click */}
      {Array.isArray(raffle?.media?.gallery) && raffle.media!.gallery.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 mt-6">
          <h3 className="text-white font-bold uppercase mb-3 text-sm tracking-wider">Galería</h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {raffle.media!.gallery.map((item) => (
              <button
                key={item.id}
                onClick={() => setModalMedia(item)}
                className="group relative rounded-xl overflow-hidden border border-gray-700 bg-black hover:border-orange-500 transition-all cursor-pointer"
              >
                {item.type === "video" ? (
                  <video
                    src={item.url}
                    playsInline
                    preload="metadata"
                    className="block w-full h-40 object-cover pointer-events-none"
                    onError={safeVideoOnError}
                  />
                ) : (
                  <img
                    src={item.url}
                    alt="media"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="block w-full h-40 object-cover"
                    onError={safeImgOnError}
                  />
                )}

                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all"></span>
                <span className="pointer-events-none absolute bottom-2 right-2 text-xs px-2 py-1 rounded bg-black/60 text-white">
                  {item.type === "video" ? "▶️" : "🖼️"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 mt-6 relative z-10 pb-20 space-y-4">
        {/* Mensaje de éxito después de enviar */}
        {submitSuccess && (
          <div
            ref={successRef}
            className="rounded-xl border-2 border-green-500 bg-green-50 p-6 shadow-lg scroll-mt-24"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-2xl">✓</span>
              </div>
              <div>
                <div className="font-bold text-green-800 text-lg">¡Reserva enviada exitosamente!</div>
                <p className="text-green-700 text-sm">Tu solicitud ha sido recibida correctamente</p>
              </div>
            </div>

            <div className="bg-green-100 rounded-lg p-4 mt-3">
              <p className="text-green-800 text-sm">
                ⏳ <strong>Estamos validando tu pago.</strong> En breve recibirás la confirmación de tus boletos
                por WhatsApp y correo electrónico.
              </p>
            </div>
          </div>
        )}

        {/* Descripción con modal */}
        {raffle.description && raffle.description.trim() && (
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-gray-700">
            <h3 className="text-white font-black uppercase mb-3 text-sm tracking-wider flex items-center gap-2">
              <div className="w-1 h-5 bg-orange-500 rounded-full"></div>
              Descripción
            </h3>

            <div className="relative">
              <p className="text-gray-300 whitespace-pre-wrap line-clamp-3">{raffle.description}</p>
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-gray-900 to-transparent"></div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowDesc(true)}
                className="px-4 py-2 rounded-lg font-semibold bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 transition-all"
              >
                Ver más
              </button>
            </div>
          </div>
        )}

        {/* Precio / cantidad */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 shadow-2xl border border-orange-500/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-gray-400 uppercase tracking-wide">Precio unitario</div>
              <div className="text-2xl font-black text-orange-400">{formatRD(price)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400 uppercase tracking-wide">Cantidad</div>
              <div className="text-2xl font-black text-white">{ticketQuantity}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 py-4">
            <button
              type="button"
              onClick={() => setTicketQuantity((q) => Math.max(1, q - 1))}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white text-3xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg active:scale-95"
            >
              −
            </button>
            <div className="flex-1 bg-black/50 rounded-2xl py-3 text-center border border-orange-500/30">
              <div className="text-4xl font-black text-white">{ticketQuantity}</div>
              <div className="text-xs text-gray-400 uppercase">boletos</div>
            </div>
            <button
              type="button"
              onClick={() => setTicketQuantity((q) => Math.min(50, q + 1))}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white text-3xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg active:scale-95"
            >
              +
            </button>
          </div>
        </div>

        {/* Boletos verificados */}
        {verifiedTickets.length > 0 && (
          <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 rounded-2xl p-5 border border-green-500/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <h3 className="text-white font-bold uppercase text-sm tracking-wide">Tus boletos verificados</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {verifiedTickets.map((t) => (
                <div
                  key={t.digits}
                  className="bg-gradient-to-br from-green-500 to-emerald-600 text-white px-5 py-3 rounded-xl font-black text-xl shadow-lg"
                >
                  {t.digits}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Datos del participante */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-gray-700">
          <h3 className="text-white font-black uppercase mb-4 text-sm tracking-wider flex items-center gap-2">
            <div className="w-1 h-5 bg-orange-500 rounded-full"></div>
            Datos del participante
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                Nombre completo
              </label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-5 py-4 bg-black/50 border border-gray-700 rounded-2xl focus:border-orange-500 focus:outline-none text-white placeholder-gray-500 text-base disabled:opacity-50"
                placeholder="Escribe tu nombre"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                Teléfono WhatsApp
              </label>
              <div className="flex gap-3">
                <select 
                  disabled={isSubmitting}
                  className="px-4 py-4 bg-black/50 border border-gray-700 rounded-2xl focus:border-orange-500 focus:outline-none text-white text-base disabled:opacity-50"
                >
                  <option>+1</option>
                </select>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(formatPhoneRD(e.target.value))}
                  disabled={isSubmitting}
                  className="flex-1 px-5 py-4 bg-black/50 border border-gray-700 rounded-2xl focus:border-orange-500 focus:outline-none text-white placeholder-gray-500 text-base disabled:opacity-50"
                  placeholder="(809)-000-0000"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                Email (opcional)
              </label>
              <input
                value={correo}
                onChange={(e) => setCorreo(cleanEmail(e.target.value))}
                disabled={isSubmitting}
                inputMode="email"
                className="w-full px-5 py-4 bg-black/50 border border-gray-700 rounded-2xl focus:border-orange-500 focus:outline-none text-white placeholder-gray-500 text-base disabled:opacity-50"
                placeholder="tu@email.com"
              />
            </div>
          </div>
        </div>

        {/* Información de pago */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-gray-700">
          <h3 className="text-white font-black uppercase mb-4 text-sm tracking-wider flex items-center gap-2">
            <div className="w-1 h-5 bg-orange-500 rounded-full"></div>
            Información de pago
          </h3>

          {/* logos bancarios */}
          {transferInstitutions.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-5">
              {transferInstitutions.map((bi, i) => {
                const isActive = i === safeIndex;
                const color = brandColor(bi.name || "");
                return (
                  <button
                    key={bi.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setInstIndex({ transfer: i })}
                    className={[
                      "rounded-2xl flex items-center justify-center border transition-all",
                      "bg-gradient-to-br from-gray-700 to-gray-800 h-28",
                      isActive ? `border-transparent ring-4 ${color.ring}` : "border-gray-600 hover:border-orange-500",
                      isSubmitting && "opacity-50 cursor-not-allowed"
                    ].join(" ")}
                    title={bi.name}
                  >
                    {bi.logo_url ? (
                      <img
                        src={bi.logo_url}
                        alt={bi.name}
                        className="w-16 h-16 object-contain"
                        onError={safeImgOnError}
                      />
                    ) : (
                      <span className="text-white font-bold text-sm">{bi.name.slice(0, 10)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {currentInstitution ? (
            <div
              className={[
                "rounded-2xl p-5 border bg-gradient-to-br",
                activeBrand.softBg,
                "border-white/10",
              ].join(" ")}
            >
              <div className="text-white/90 font-bold mb-3 text-sm flex items-center gap-2">
                {currentInstitution.logo_url && (
                  <img
                    src={currentInstitution.logo_url}
                    className="w-6 h-6 object-contain"
                    alt=""
                    onError={safeImgOnError}
                  />
                )}
                {currentInstitution.name}
                <span className="text-xs text-gray-400">(Transferencia)</span>
              </div>

              <div className="space-y-2 text-sm">
                {currentInstitution.account && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Cuenta</span>
                    <span className="font-mono text-white font-semibold">{currentInstitution.account}</span>
                  </div>
                )}
                {currentInstitution.holder && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Titular</span>
                    <span className="text-white font-medium">{currentInstitution.holder}</span>
                  </div>
                )}
                {currentInstitution.extra && <div className="text-gray-300 whitespace-pre-wrap">{currentInstitution.extra}</div>}
                <div className="pt-2 border-t border-white/10">
                  <div className="flex justify-between items-baseline">
                    <span className="text-gray-400">Monto a transferir</span>
                    <div className="text-right">
                      <div className="text-2xl font-black text-orange-400">{formatRD(total)}</div>
                      <div className="text-xs text-gray-500">
                        {ticketQuantity} {ticketQuantity === 1 ? "boleto" : "boletos"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            bank_name && (
              <div className="bg-gradient-to-br from-orange-950/50 to-orange-900/30 rounded-2xl p-5 border border-orange-500/30">
                <div className="text-orange-300 font-bold mb-3 text-sm">{bank_name}</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Cuenta</span>
                    <span className="font-mono text-white font-semibold">{bank_account}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Titular</span>
                    <span className="text-white font-medium">{bank_holder}</span>
                  </div>
                  <div className="pt-2 border-t border-orange-500/20">
                    <div className="flex justify-between items-baseline">
                      <span className="text-gray-400">Monto a transferir</span>
                      <div className="text-right">
                        <div className="text-2xl font-black text-orange-400">{formatRD(total)}</div>
                        <div className="text-xs text-gray-500">
                          {ticketQuantity} {ticketQuantity === 1 ? "boleto" : "boletos"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Comprobante + Términos */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 shadow-xl border border-gray-700">
          <h3 className="text-white font-black uppercase mb-4 text-sm tracking-wider flex items-center gap-2">
            <div className="w-1 h-5 bg-orange-500 rounded-full"></div>
            Comprobante de pago
          </h3>

          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className={[
              "border-2 border-dashed border-gray-600 rounded-2xl p-8 text-center hover:border-orange-500 transition-all cursor-pointer bg-black/30",
              isSubmitting && "opacity-50 cursor-not-allowed pointer-events-none"
            ].join(" ")}
            onClick={() => !isSubmitting && fileInputRef.current?.click()}
          >
            {selectedFile ? (
              <div>
                <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-3xl font-bold">✓</span>
                </div>
                <p className="font-semibold text-white text-sm break-all px-2">{selectedFile.name}</p>
                {!isSubmitting && <p className="text-xs text-gray-400 mt-2">Toca para cambiar</p>}
              </div>
            ) : (
              <div>
                <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl flex items-center justify-center">
                  <span className="text-4xl">📸</span>
                </div>
                <p className="font-semibold text-white mb-1">Sube tu comprobante</p>
                <p className="text-xs text-gray-400">Foto o captura de pantalla</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              disabled={isSubmitting}
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="mt-4 flex items-start gap-3 bg-black/30 rounded-2xl p-3">
            <input
              type="checkbox"
              id="terms"
              checked={acceptedTerms}
              disabled={isSubmitting}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-orange-500 cursor-pointer disabled:cursor-not-allowed"
            />
            <label htmlFor="terms" className="text-xs text-gray-300 cursor-pointer">
              Acepto los términos y condiciones del sorteo
            </label>
          </div>
        </div>

        {/* Confirmar */}
        <button
          onClick={handleSubmit}
          disabled={!acceptedTerms || isSubmitting}
          className={[
            "w-full text-white text-xl font-black uppercase py-5 rounded-2xl transition-all shadow-2xl active:scale-[0.98]",
            isSubmitting 
              ? "bg-gradient-to-r from-blue-500 to-blue-600 cursor-wait"
              : !acceptedTerms
              ? "bg-gradient-to-r from-gray-700 to-gray-800 cursor-not-allowed"
              : "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-orange-500/20"
          ].join(" ")}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center gap-3">
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>RESERVANDO...</span>
            </div>
          ) : (
            "CONFIRMAR RESERVA"
          )}
        </button>

        {/* Buscador de boletos */}
        <TicketFinder raffleId={raffle.id} />
      </main>

      {/* MODAL: descripción completa */}
      <DescriptionModal
        open={showDesc}
        onClose={() => setShowDesc(false)}
        title={raffle.title}
        description={raffle.description ?? ""}
      />

      {/* MODAL: galería media */}
      <MediaModal
        media={modalMedia}
        onClose={() => setModalMedia(null)}
      />
    </div>
  );
}

/* ===========================
   MODAL: Descripción completa
   =========================== */
type DescriptionModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
};

function DescriptionModal({ open, onClose, title, description }: DescriptionModalProps) {
  if (!open) return null;

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      onKeyDown={onKey}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/70" />

      {/* Panel */}
      <div className="relative w-full sm:max-w-2xl sm:rounded-2xl sm:overflow-hidden bg-gradient-to-br from-gray-900 to-black border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h4 className="text-white font-bold truncate pr-4">{title} — Detalles</h4>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-white" title="Cerrar">
            ✕
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div className="prose prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-gray-200 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold bg-gray-700 text-white hover:bg-gray-600">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   MODAL: Galería (imagen/video)
   =========================== */
type MediaModalProps = {
  media: GalleryItem | null;
  onClose: () => void;
};

function MediaModal({ media, onClose }: MediaModalProps) {
  if (!media) return null;

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") onClose();
  }

  const safeImgOnError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "1";
    img.src = "/img-fallback.png";
    img.classList.add("opacity-40");
  };

  const safeVideoOnError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.dataset.fallbackApplied) return;
    v.dataset.fallbackApplied = "1";
    v.poster = "/video-fallback.png";
    v.classList.add("opacity-40");
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onKeyDown={onKey}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <button 
        aria-label="Cerrar" 
        onClick={onClose} 
        className="absolute inset-0 bg-black/90 backdrop-blur-sm" 
      />

      {/* Panel */}
      <div className="relative w-full max-w-5xl">
        <button 
          onClick={onClose} 
          className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all z-10" 
          title="Cerrar"
        >
          ✕
        </button>

        <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
          {media.type === "video" ? (
            <video
              src={media.url}
              controls
              autoPlay
              playsInline
              className="w-full max-h-[80vh] object-contain"
              onError={safeVideoOnError}
            />
          ) : (
            <img
              src={media.url}
              alt="Media"
              className="w-full max-h-[80vh] object-contain"
              onError={safeImgOnError}
            />
          )}
        </div>
      </div>
    </div>
  );
}