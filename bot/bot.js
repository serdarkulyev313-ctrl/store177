require("dotenv").config({ path: ".env.local" });
const { Bot, InlineKeyboard } = require("grammy");

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrlRaw = process.env.PUBLIC_APP_URL;

const adminIds = new Set(
  (process.env.ADMIN_TG_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n))
);

if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");
if (!appUrlRaw) throw new Error("PUBLIC_APP_URL missing");

const appUrl = appUrlRaw.replace(/\/$/, "");
const adminUrl = `${appUrl}/admin`;

const bot = new Bot(token);

bot.command("myid", async (ctx) => {
  await ctx.reply(`Твой Telegram ID: ${ctx.from?.id}`);
});

bot.command("start", async (ctx) => {
  const kb = new InlineKeyboard().webApp("🛒 Открыть магазин", appUrl);

  if (ctx.from && adminIds.has(ctx.from.id)) {
    kb.row().webApp("🔧 Админка", adminUrl);
  }

  await ctx.reply("Store 177 — выбирай:", { reply_markup: kb });
});

module.exports = { bot };
