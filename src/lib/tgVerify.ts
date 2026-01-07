import crypto from "crypto";

type TgUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

function timingSafeEqualHex(a: string, b: string) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function verifyTelegramInitData(initData: string): { ok: true; user: TgUser | null } | { ok: false; error: string } {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  // ✅ чтобы сервер НЕ падал, а нормально отдавал ошибку
  if (!botToken) return { ok: false, error: "TELEGRAM_BOT_TOKEN missing" };
  if (!initData) return { ok: false, error: "initData empty" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  if (!hash) return { ok: false, error: "hash missing" };

  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key === "hash") return;
    pairs.push(`${key}=${value}`);
  });

  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const signature = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const ok = timingSafeEqualHex(signature, hash);
  if (!ok) return { ok: false, error: "bad signature" };

  let user: TgUser | null = null;
  const userRaw = params.get("user");
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch {
      user = null;
    }
  }

  return { ok: true, user };
}
