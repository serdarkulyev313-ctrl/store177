import { NextResponse } from "next/server";
import { verifyTelegramInitData } from "../../../lib/tgVerify";


export async function GET(req: Request) {
  const initData = req.headers.get("x-tg-init-data") || "";
  const token = process.env.TELEGRAM_BOT_TOKEN || "";

  if (!token) return new NextResponse("Server error: TELEGRAM_BOT_TOKEN is empty", { status: 500 });

  if (!initData) {
    return new NextResponse("OK (no initData). Later we will open inside Telegram.", { status: 200 });
  }

  const check = verifyTelegramInitData(initData, token);
  if (!check.ok) {
    return new NextResponse(`Bad initData: ${check.reason}`, { status: 401 });
  }

  const u = check.user;
  const who = u ? `${u.id} @${u.username || "-"} ${u.first_name || ""}` : "no user";
  return new NextResponse(`OK initData ✅ user: ${who}`, { status: 200 });
}
