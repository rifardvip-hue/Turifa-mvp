// middleware.ts (opcional)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  // Esto mantiene la cookie de sesión fresca; NO redirige.
  const supabase = createMiddlewareClient({ req, res });
  await supabase.auth.getSession();
  return res;
}

// Si quieres limitarlo a /admin, puedes:
export const config = { matcher: ["/admin/:path*"] };
