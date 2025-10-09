"use client";
import { useRef, useState } from "react";

export default function RifaCliente({
  raffleId,
  blocks,
  price,
}: {
  raffleId: string;
  blocks: number[][];
  price: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    correo: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !acceptedTerms) return;

    setLoading(true);

    try {
      // 1. Crear reserva
      const res = await fetch("/api/orders/create-reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raffle_id: raffleId,
          nombre: form.nombre,
          telefono: form.telefono,
          correo: form.correo,
          blocks, // arreglo de bloques con 4 números cada uno
        }),
      });

      const { ok, order_id, payment_id } = await res.json();

      if (!ok) throw new Error("Error al crear la reserva");

      // 2. Subir el comprobante
      const formData = new FormData();
      formData.append("payment_id", payment_id);
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload/voucher", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.ok) throw new Error("Error al subir comprobante");

      alert("✅ ¡Reserva enviada con éxito! Espera confirmación del administrador.");
      setForm({ nombre: "", telefono: "", correo: "" });
      setFile(null);
      setAcceptedTerms(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      alert("❌ Ocurrió un error al enviar tu reserva.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4 mt-6" onSubmit={handleSubmit}>
      <input
        name="nombre"
        placeholder="Nombre completo"
        required
        value={form.nombre}
        onChange={handleChange}
        className="w-full border p-3 rounded-md"
      />
      <input
        name="telefono"
        placeholder="Teléfono (WhatsApp)"
        required
        value={form.telefono}
        onChange={handleChange}
        className="w-full border p-3 rounded-md"
      />
      <input
        name="correo"
        placeholder="Correo electrónico"
        value={form.correo}
        onChange={handleChange}
        className="w-full border p-3 rounded-md"
      />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Subir comprobante de pago:</label>
        <input
          ref={fileInputRef}
          type="file"
          name="voucher"
          accept="image/*"
          required
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full border p-2 rounded-md"
        />
        {file && <p className="text-sm text-gray-600">📄 {file.name}</p>}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          required
        />
        <label className="text-sm">
          Acepto los <a href="#" className="underline text-blue-600">términos y condiciones</a>.
        </label>
      </div>

      <button
        type="submit"
        className={`w-full text-white text-lg py-3 rounded-md transition ${
          acceptedTerms ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 cursor-not-allowed"
        }`}
        disabled={!acceptedTerms || loading}
      >
        {loading ? "Enviando..." : "✅ Enviar reserva"}
      </button>
    </form>
  );
}
