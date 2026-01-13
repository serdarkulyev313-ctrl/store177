"use client";

import { useEffect, useState } from "react";

type TgUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

declare global {
  interface Window {
    Telegram?: any;
  }
}

function parseHashParams() {
  const raw = (window.location.hash || "").replace(/^#/, "");
  return new URLSearchParams(raw);
}

function getInitData(): string {
  const tgInit = window.Telegram?.WebApp?.initData;
  if (typeof tgInit === "string" && tgInit.length > 0) return tgInit;

  const hp = parseHashParams();
  const fromHash = hp.get("tgWebAppData");
  if (fromHash && fromHash.length > 0) return fromHash;

  return "";
}

export function useTelegram() {
  const [initData, setInitData] = useState("");
  const [user, setUser] = useState<TgUser | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();

    setInitData(getInitData());
    const unsafeUser = tg?.initDataUnsafe?.user;
    if (unsafeUser?.id) {
      setUser({
        id: unsafeUser.id,
        first_name: unsafeUser.first_name,
        last_name: unsafeUser.last_name,
        username: unsafeUser.username,
        photo_url: unsafeUser.photo_url,
      });
    }
  }, []);

  return { initData, user };
}
