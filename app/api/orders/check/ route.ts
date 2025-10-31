// app/api/orders/check/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const payment_id = searchParams.get("payment_id");

  if (!payment_id) {
    return NextResponse.json({ ok: false, error: "MISSING_PAYMENT_ID" }, { status: 400 });
  }

  // 🔧 MOCK: aún no verificado
  return NextResponse.json({
    ok: true,
    verified: false,
    tickets: [], // cuando verifiques, envía [{digits:"1234"}]
  });
}
