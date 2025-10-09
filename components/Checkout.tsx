"use client";
import { useState } from "react";

type Props = {
  slug: string;
  selected: number[];
  price: number;
  bank?: string;
  onSuccess?: () => void;
};

export default function Checkout({ slug, selected, price, bank, onSuccess }: Props) {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", doc_id: "" });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const total = selected.length * price;
  const change = (k: string, v: string) => setForm(s => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!selected.length) return alert("Selecciona al menos un boleto");
    if (!form.full_name || !form.phone) return alert("Nombre y teléfono son obligatorios");
    setLoading(true);
    try {
      // 1) Crear reserva
      const r = await fetch("/api/orders/create-reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raffle_slug: slug,
          buyer: form,
          numbers: selected,
          amount: total
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al reservar");

      // 2) Subir comprobante (opcional)
      if (file) {
        const fd = new FormData();
        fd.append("payment_id", d.payment_id);
        fd.append("file", file);
        const up = await fetch("/api/upload/voucher", { method: "POST", body: fd });
        if (!up.ok) {
          console.warn("No se pudo subir el comprobante ahora.");
        }
      }

      alert("Reserva creada. Estamos revisando tu comprobante.");
      onSuccess?.();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 16 }}>
      <h3>Datos del comprador</h3>
      <input placeholder="Nombre completo" value={form.full_name} onChange={e=>change("full_name", e.target.value)} /><br/>
      <input placeholder="Email (opcional)" value={form.email} onChange={e=>change("email", e.target.value)} /><br/>
      <input placeholder="Teléfono (obligatorio)" value={form.phone} onChange={e=>change("phone", e.target.value)} /><br/>
      <input placeholder="Cédula (opcional)" value={form.doc_id} onChange={e=>change("doc_id", e.target.value)} /><br/>
      <p><b>Total:</b> RD${Number(total).toLocaleString()}</p>

      <h4>Instrucciones bancarias</h4>
      <pre style={{ background:"#f5f5f5", padding:8 }}>{bank || "—"}</pre>

      <div style={{ margin:"8px 0" }}>
        <label>Subir comprobante (imagen): </label>
        <input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0] || null)} />
      </div>

      <button onClick={submit} disabled={loading}>
        {loading ? "Enviando..." : "Enviar reserva"}
      </button>
    </div>
  );
}
