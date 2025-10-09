"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient"; // tu inicialización

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else window.location.href = "/admin/reservations";
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Login Admin</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        />
        <button type="submit" className="w-full bg-blue-600 text-white rounded px-4 py-2">
          Entrar
        </button>
      </form>
    </main>
  );
}
