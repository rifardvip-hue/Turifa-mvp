"use client";

import { useState } from "react";
import Image from "next/image";

export default function Home() {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [boleto, setBoleto] = useState("");
  const [mensaje, setMensaje] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje("");

    if (!nombre || !telefono || !boleto) {
      setMensaje("Por favor completa todos los campos obligatorios.");
      return;
    }

    try {
      const res = await fetch("/api/orders/create-reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raffle_slug: "iphone15", // 👈 cambia según tu slug
          buyer: {
            full_name: nombre,
            phone: telefono,
            email: email || null,
          },
          numbers: [parseInt(boleto)],
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("🎉 Reserva realizada con éxito");
        console.log("ID de pago:", data.payment_id);
        setNombre("");
        setTelefono("");
        setEmail("");
        setBoleto("");
      } else {
        setMensaje(data.error || "Error al enviar la reserva.");
      }
    } catch (err) {
      console.error(err);
      setMensaje("Error de conexión al servidor.");
    }
  };

  return (
    <div className="font-sans min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[#f9f9f9]">
      <Image
        src="/banner-raffle.jpg" // 👈 asegúrate que la imagen esté en /public
        alt="Banner Rifa"
        width={600}
        height={300}
        className="mb-6 rounded-md shadow"
      />

      <form
        onSubmit={handleSubmit}
        className="bg-white w-full max-w-md p-6 rounded-lg shadow-md space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">🎉 Sorteo iPhone 15</h1>
        <p className="text-center text-sm text-gray-600">
          Participa con los últimos 4 dígitos de tu boleto
        </p>

        <input
          type="text"
          placeholder="Nombre completo"
          className="w-full border p-2 rounded"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Teléfono (WhatsApp)"
          className="w-full border p-2 rounded"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          required
        />

        <input
          type="email"
          placeholder="Correo electrónico (opcional)"
          className="w-full border p-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="number"
          placeholder="Número del boleto (ej: 14)"
          className="w-full border p-2 rounded"
          value={boleto}
          onChange={(e) => setBoleto(e.target.value)}
          required
        />

        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded font-semibold"
        >
          Enviar reserva
        </button>

        {mensaje && (
          <p className="text-red-600 text-sm text-center">{mensaje}</p>
        )}
      </form>
    </div>
  );
}
