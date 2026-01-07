import crypto from "crypto";

export type TgUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export function validateAndParseInitData(initDataRaw: string, botToken: string, maxAgeSec = 86400) {
  if (!initDataRaw) return { ok: false as const, error: "initData empty" };

  const decoded = decodeURIComponent(initDataRaw);
  const pairs = decoded.split("&");

  const hashPairIndex = pairs.findIndex((p) => p.startsWith("hash="));
  if (hashPairIndex === -1) return { ok: false as const, error: "hash missing" };

  const hash = pairs[hashPairIndex].slice("hash=".length);
  const dataPairs = pairs.filter((_, i) => i !== hashPairIndex).sort((a, b) => a.localeCompare(b));
  const dataCheckString = dataPairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) return { ok: false as const, error: "hash mismatch" };

  const sp = new URLSearchParams(decoded);
  const authDate = Number(sp.get("auth_date") || 0);
  if (authDate) {
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > maxAgeSec) return { ok: false as const, error: "auth_date expired" };
  }

  const userStr = sp.get("user");
  const user = userStr ? (JSON.parse(userStr) as TgUser) : null;

  return { ok: true as const, user };
}

export function isAdmin(userId: number) {
  const raw = process.env.ADMIN_TG_IDS || "";
  const set = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n))
  );
  return set.has(userId);
}
