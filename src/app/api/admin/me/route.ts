export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { validateAndParseInitData, isAdmin } from "@/lib/tgAuth";

export async function GET(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!botToken) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN empty" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const v = validateAndParseInitData(initData, botToken);
  if (!v.ok || !v.user) {
    return NextResponse.json(
      { ok: false, error: v.ok ? "no user" : v.error },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { ok: true, user: v.user, role: isAdmin(v.user.id) ? "admin" : "user" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
