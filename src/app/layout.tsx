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
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
