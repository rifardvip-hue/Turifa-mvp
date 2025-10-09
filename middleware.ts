// /middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // cookies en Edge son síncronas
  const names = req.cookies.getAll().map(c => c.name);

  const hasSupabaseSession =
    names.some(n => n === "sb-access-token" || n === "sb-refresh-token") || // viejo
    names.some(n => /^sb-.*-auth-token$/.test(n));                         // nuevo (tu caso)

  if (!hasSupabaseSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
