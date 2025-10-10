// app/admin/layout.tsx
import React, { ReactNode } from "react";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // ✅ cookies() es síncrono en Server Components
  const cookieStore = cookies();

  const supabase = createServerComponentClient({ cookies: () => cookieStore });

  const { data: { user } = { user: null } } = await supabase.auth.getUser();

  // (Opcional) Redirige si no hay admin – o muestra un wrapper
  // if (!user || user.user_metadata?.role !== "admin") {
  //   return <div className="p-6 text-sm text-red-600">Acceso no autorizado</div>;
  // }

  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
