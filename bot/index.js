require("dotenv").config({ path: ".env.local" });
const { Bot, InlineKeyboard } = require("grammy");

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = process.env.PUBLIC_APP_URL;
const adminIds = new Set(
  (process.env.ADMIN_TG_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
);

if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");
if (!appUrl) throw new Error("PUBLIC_APP_URL missing");

const bot = new Bot(token);

// ✅ Узнать свой Telegram ID (чтобы добавлять админов в ADMIN_TG_IDS)
bot.command("myid", async (ctx) => {
  await ctx.reply(`Твой Telegram ID: ${ctx.from.id}`);
});

bot.command("start", async (ctx) => {
  await ctx.reply("Store 177 — готово.", { reply_markup: { remove_keyboard: true } });

  const kb = new InlineKeyboard().webApp("🛒 Открыть магазин", appUrl);

  if (adminIds.has(ctx.from.id)) {
    kb.row().webApp("🔧 Админка", appUrl.replace(/\/$/, "") + "/admin");
  }

  await ctx.reply("Выбирай:", { reply_markup: kb });
});

bot.start();
console.log("Bot started");
