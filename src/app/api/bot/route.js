import { Bot, InlineKeyboard } from "grammy";
import { webhookCallback } from "grammy";

export const runtime = "nodejs";

const token = process.env.TELEGRAM_BOT_TOKEN!;
const appUrlRaw = process.env.PUBLIC_APP_URL!;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";

if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");
if (!appUrlRaw) throw new Error("PUBLIC_APP_URL missing");

const appUrl = appUrlRaw.replace(/\/$/, "");

const adminIds = new Set(
  (process.env.ADMIN_TG_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n))
);

const bot = new Bot(token);

bot.command("myid", async (ctx) => {
  await ctx.reply(`Твой Telegram ID: ${ctx.from?.id}`);
});

bot.command("start", async (ctx) => {
  const kb = new InlineKeyboard().webApp("🛒 Открыть магазин", appUrl);

  if (ctx.from && adminIds.has(ctx.from.id)) {
    kb.row().webApp("🔧 Админка", `${appUrl}/admin`);
  }

  await ctx.reply("Store 177 — готово.\nВыбирай:", { reply_markup: kb });
});

const handleUpdate = webhookCallback(bot, "std/http");

export async function POST(req: Request) {
  if (secret) {
    const h = req.headers.get("x-telegram-bot-api-secret-token") || "";
    if (h !== secret) return new Response("Unauthorized", { status: 401 });
  }
  return handleUpdate(req);
}

export async function GET() {
  return new Response("OK");
}
