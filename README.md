# Store 177 (Telegram Mini App)

## Быстрый старт (локально)

1) Установите зависимости:

```bash
npm install
```

2) Подготовьте переменные окружения в `.env.local`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require"
TELEGRAM_BOT_TOKEN="<token>"
ADMIN_TG_IDS="123456789,987654321"
PUBLIC_APP_URL="https://your-domain"
BLOB_READ_WRITE_TOKEN="<vercel-blob-token>"
```

3) Примените миграции и сгенерируйте клиент Prisma:

```bash
npm run db:generate
npm run db:migrate
```

4) Запустите dev-сервер:

```bash
npm run dev
```

## Postgres (Neon/Supabase)

Проект работает с любым Postgres по `DATABASE_URL`.
- Для Vercel можно подключить Neon/Supabase и добавить `DATABASE_URL` в Environment Variables.

## Загрузка фото (Vercel Blob)

Для загрузки фото нужен токен:
- `BLOB_READ_WRITE_TOKEN` (Vercel Blob)

API:
- `POST /api/admin/upload-image` (multipart/form-data, поля: `file`, `productId`)

## Vercel деплой

1) Добавьте переменные окружения в проект Vercel:
   - `DATABASE_URL`
   - `TELEGRAM_BOT_TOKEN`
   - `ADMIN_TG_IDS`
   - `PUBLIC_APP_URL`
   - `BLOB_READ_WRITE_TOKEN`
2) Выполните redeploy.

## Полезные команды

```bash
npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
npm run build
```
