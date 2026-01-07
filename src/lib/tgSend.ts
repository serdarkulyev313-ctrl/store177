type TgSendOptions = {
  parse_mode?: "HTML" | "MarkdownV2";
  disable_web_page_preview?: boolean;
  reply_markup?: any;
};

export async function tgSendMessage(chatId: number | string, text: string, options: TgSendOptions = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode ?? "HTML",
      disable_web_page_preview: options.disable_web_page_preview ?? true,
      reply_markup: options.reply_markup,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    console.error("tgSendMessage failed:", { chatId, text, data });
    return { ok: false as const, error: data };
  }

  return { ok: true as const };
}
