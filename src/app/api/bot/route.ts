import { NextResponse } from "next/server";
import { Bot, InlineKeyboard } from "grammy";

export const runtime = "nodejs";

const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
const appUrl = process.env.PUBLIC_APP_URL ?? "";
const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
const storeName = process.env.STORE_NAME ?? "Store 177";

function getAdminIds(): Set<number> {
  return new Set(
    (process.env.ADMIN_TG_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n))
  );
}

const bot = new Bot(token);

bot.command("myid", async (ctx) => {
  await ctx.reply(`Твой Telegram ID: ${ctx.from?.id}`);
});

bot.command("start", async (ctx) => {
  const kb = new InlineKeyboard().webApp("🛒 Открыть магазин", appUrl);

  const adminIds = getAdminIds();
  if (ctx.from?.id && adminIds.has(ctx.from.id)) {
    kb.row().webApp("🔧 Админка", appUrl.replace(/\/$/, "") + "/admin");
  }

  await ctx.reply(`${storeName} — готово.`, { reply_markup: { remove_keyboard: true } });
  await ctx.reply("Выбирай:", { reply_markup: kb });
});

export async function POST(req: Request) {
  if (secret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token") || "";
    if (got !== secret) return new NextResponse("forbidden", { status: 403 });
  }

  const update = await req.json();
  await bot.init();
  await bot.handleUpdate(update);

return NextResponse.json({ ok: true });

}

export async function GET() {
  return NextResponse.json({ ok: true, status: "alive" });
}
