import "./globals.css";

import Script from "next/script";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Store 177",
  description: "Telegram Mini App Store 177",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        {/* Telegram WebApp script (обязателен, чтобы появился window.Telegram) */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
