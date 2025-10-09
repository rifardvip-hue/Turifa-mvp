// ✅ app/rifa/[slug]/page.tsx
"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { useParams } from "next/navigation";
import TicketGrid from "@/components/TicketGrid";
import TicketStack from "@/components/TicketStack";

export default function RifaSlugPage() {
  const { slug } = useParams();
  const [raffle, setRaffle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 🔢 cantidad y selección de números
  const [ticketQuantity, setTicketQuantity] = useState<number>(1);
  const [selectedBlocks, setSelectedBlocks] = useState<number[][]>([]);

  useEffect(() => {
    async function fetchRaffle() {
      const res = await fetch(`/api/raffles/${slug}`);
      const data = await res.json();
      setRaffle(data);
      setLoading(false);
    }
    fetchRaffle();
  }, [slug]);

  if (loading) return <p className="text-center mt-10">Cargando...</p>;
  if (!raffle?.id) return <p className="text-center mt-10 text-red-600">Rifa no encontrada.</p>;

  // 🧮 total (por si lo usas en otro lugar)
  const total = ticketQuantity * Number(raffle.price);

  // manejar input de cantidad
  const onCantidadChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(1, Math.min(10, Number(e.target.value || 1)));
    setTicketQuantity(v);
  };

  // lista plana de números seleccionados
  const selectedNumbers = selectedBlocks.flat();

  return (
    <main className="max-w-lg mx-auto p-4 space-y-6 bg-gray-50 min-h-screen">
      <img
        src={raffle.banner_url || "https://via.placeholder.com/600x300"}
        alt="Banner"
        className="w-full rounded-lg shadow-md"
      />

      <div className="text-center">
        <h1 className="text-2xl font-bold">🎉 {raffle.title}</h1>
        <p className="text-lg text-green-600 font-semibold mt-1">🎫 RD${raffle.price}</p>
        <p className="text-sm mt-1 text-gray-600">{raffle.description}</p>
      </div>

      {/* ---------- Bloque de selección y visualización de boletos ---------- */}
      <section className="space-y-3">
        <h2 className="text-center font-semibold">Tus boletos</h2>

        {/* Grilla para elegir números */}
        <TicketGrid
          raffleId={raffle.id}
          quantity={ticketQuantity}
          price={raffle.price}
          onChange={setSelectedBlocks}
        />

        {/* Pila animada:
            - si ya hay números seleccionados, los muestra
            - si no, muestra la cantidad (amount) */}
        <div className="mt-2 flex justify-center">
          {selectedNumbers.length > 0 ? (
            <TicketStack
              tickets={selectedNumbers}
              title={raffle.title}
              priceLabel={`RD$${raffle.price}`}
            />
          ) : (
            <TicketStack
              amount={ticketQuantity}
              title={raffle.title}
              priceLabel={`RD$${raffle.price}`}
            />
          )}
        </div>
      </section>

      {/* ---------- Formulario ---------- */}
      <form className="space-y-4">
        <input name="nombre" placeholder="Nombre completo" required className="w-full border p-3 rounded-md" />
        <input name="telefono" placeholder="Teléfono (WhatsApp)" required className="w-full border p-3 rounded-md" />
        <input name="correo" placeholder="Correo electrónico" className="w-full border p-3 rounded-md" />

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">Cantidad de boletos</label>
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
            <p className="text-xs text-gray-500 mt-1">Total estimado: <strong>RD${total}</strong></p>
          </div>
        </div>

        <div className="bg-gray-100 p-3 rounded-md text-sm">
          <p className="font-semibold mb-1">Instrucciones de pago:</p>
          <p><strong>Banco:</strong> {raffle.bank_name}</p>
          <p><strong>Cuenta:</strong> {raffle.bank_account}</p>
          <p><strong>Nombre:</strong> {raffle.bank_holder}</p>
        </div>

        <input type="file" name="voucher" accept="image/*" required className="w-full" />

        <button
          type="submit"
          className="w-full bg-green-600 text-white text-xl py-3 rounded-md hover:bg-green-700"
        >
          ✅ Enviar reserva
        </button>
      </form>
    </main>
  );
}
