"use client";
import { AnimatePresence, motion } from "framer-motion";
import React from "react";

type VerifiedTicket = { digits: string; verified: true };

type TicketStackProps = {
  title?: string;
  priceLabel?: string;
  assigned?: VerifiedTicket[];
  amount?: number;
  pending?: boolean;
  maxVisible?: number;
};

export default function TicketStack({
  title = "Boleto de Rifa",
  priceLabel,
  assigned = [],
  amount = 0,
  pending = false,
  maxVisible = 5,
}: TicketStackProps) {
  const verified = assigned.filter((t) => t.verified && /^[1-9]{4}$/.test(t.digits));
  const mode: "verified" | "pending" | "selecting" =
    verified.length > 0 ? "verified" : pending ? "pending" : amount > 0 ? "selecting" : "pending";

  const itemsAll =
    mode === "selecting"
      ? Array.from({ length: amount }, (_, i) => ({ key: `sel-${i}`, idx: i }))
      : [{ key: mode === "verified" ? `v-${verified.length}` : `p-1`, idx: 0 }];

  const items = mode === "selecting" ? itemsAll.slice(0, maxVisible) : itemsAll;
  const hiddenCount = mode === "selecting" ? Math.max(0, itemsAll.length - items.length) : 0;

  const step = 18;
  const containerH = (mode === "selecting" ? items.length : 1) * step + 180;
  const visibleDigits = mode === "verified" ? verified[verified.length - 1].digits : undefined;

  return (
    <div className="relative w-full max-w-sm mx-auto overflow-hidden" style={{ height: containerH, perspective: 1200 }}>
      {hiddenCount > 0 && mode === "selecting" && (
        <div className="absolute -top-2 -right-2 z-[2000]">
          <span className="text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow">
            +{hiddenCount}
          </span>
        </div>
      )}

      <AnimatePresence initial={false}>
        {items.map(({ key, idx }) => (
          <motion.div
            key={key}
            className="absolute left-0 right-0 mx-auto origin-top"
            style={{ zIndex: 1000 - idx, transformStyle: "preserve-3d" }}
            initial={{ rotateX: -90, y: 40, opacity: 0 }}
            animate={{ rotateX: 0, y: idx * step, opacity: 1, rotateZ: mode === "selecting" ? (idx % 2 ? -1 : 1) * 0.4 : 0 }}
            exit={{ rotateX: 90, y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 18 }}
          >
            <TicketCard
              title={title}
              priceLabel={priceLabel}
              state={mode === "verified" ? "verified" : mode === "pending" ? "pending" : "selecting"}
              digits={visibleDigits}
              seed={idx}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function TicketCard({
  title,
  priceLabel,
  state,
  digits,
  seed = 0,
}: {
  title: string;
  priceLabel?: string;
  state: "selecting" | "pending" | "verified";
  digits?: string;
  seed?: number;
}) {
  const isVerified = state === "verified";
  const ghost = ghostDigits(seed);
  const digitsKey = isVerified ? `ok-${digits}` : `gh-${seed}`;

  return (
    <div className="w-[330px] sm:w-[360px] mx-auto [backface-visibility:hidden]">
      <div
        className="
          relative rounded-2xl border overflow-hidden shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]
          bg-[linear-gradient(135deg,#fff7e7_0%,#ffe9ba_100%)]
          border-amber-200
        "
      >
        {/* brillo diagonal */}
        <div className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(120deg,transparent,black,transparent)] opacity-30">
          <div className="absolute -top-1/2 -left-1/3 w-[140%] h-[200%] rotate-[20deg]
                          bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.65),transparent_60%)]" />
        </div>

        {/* perforaciones */}
        <div className="absolute left-0 top-0 h-full w-3 flex flex-col justify-between py-2 pl-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-white border border-amber-200" />
          ))}
        </div>
        <div className="absolute right-0 top-0 h-full w-3 flex flex-col justify-between py-2 pr-1 items-end">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-white border border-amber-200" />
          ))}
        </div>

        {/* header */}
        <div className="px-5 py-3 border-b border-dashed border-amber-300 bg-amber-100/60">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${isVerified ? "text-emerald-700" : "text-amber-800/80"}`}>
              {isVerified ? "BOLETO VERIFICADO" : "BOLETO"}
            </span>
            {priceLabel && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-600/15 text-emerald-700 border border-emerald-600/30">
                {priceLabel}
              </span>
            )}
          </div>
        </div>

        {/* body */}
        <div className="px-5 py-4">
          <h3 className="text-base font-extrabold text-amber-900">{title}</h3>
          {isVerified ? (
            <p className="text-xs text-emerald-700 mt-1">¡Pago verificado!</p>
          ) : state === "pending" ? (
            <p className="text-xs text-amber-800/70 mt-1">
              Pendiente de verificación. Mostraremos tus números al confirmar el pago.
            </p>
          ) : (
            <p className="text-xs text-amber-800/70 mt-1">Seleccionando boletos…</p>
          )}

          {/* dígitos con blur→focus */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={digitsKey}
                initial={{ opacity: 0, filter: "blur(6px)" }}
                animate={{ opacity: 1, filter: isVerified ? "blur(0px)" : "blur(6px)" }}
                exit={{ opacity: 0, filter: "blur(6px)" }}
                transition={{ duration: 0.45 }}
                className="flex gap-2"
              >
                {(isVerified ? digits!.split("") : ghost.split("")).map((d, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center justify-center w-[42px] h-12 rounded-md font-extrabold text-[22px] border shadow-sm
                                ${isVerified ? "bg-white border-amber-300 text-amber-900"
                                              : "bg-white/85 border-amber-200 text-amber-700/80"}`}
                  >
                    {d}
                  </span>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* footer */}
        <div className="px-5 py-2 border-t border-dashed border-amber-300 bg-amber-50/70 text-[10px] text-amber-700/70">
          Válido solo para esta rifa • No transferible
        </div>
      </div>
    </div>
  );
}

function ghostDigits(seed: number) {
  const base = [1,2,3,4,5,6,7,8,9];
  let s = (seed * 73 + 11) % 97;
  const pick = () => base[(s = (s * 5 + 3) % 9)];
  return `${pick()}${pick()}${pick()}${pick()}`;
}
