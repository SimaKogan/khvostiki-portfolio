# API заявок на усыновление

Vercel Function (Node.js): принимает JSON из формы на сайте, проверяет его и пересылает сообщение в Telegram.
Работает на **бесплатном тарифе Hobby** (банковская карта не нужна).

```text
Браузер ──POST /api/apply──▶ Vercel Function ──sendMessage──▶ Telegram-чат волонтёров
```

> Тариф Hobby предназначен для личных некоммерческих проектов (портфолио подходит). Если проект станет коммерческим, понадобится платный тариф или другой хостинг. Ядро (`lib/handle.js`) не привязано к платформе, и его легко перенести.

## Структура

```text
server/
├── api/apply.js        # точка входа Vercel: адаптер req/res → Request/Response
├── lib/handle.js       # ядро: CORS, лимиты, валидация, отправка в Telegram
├── lib/validate.js     # чистая валидация и форматирование сообщения
├── lib/rate-limit.js   # ограничитель частоты (скользящее окно)
├── dev-server.mjs      # локальный запуск без Vercel CLI
├── test/               # 34 автотеста (node:test)
├── vercel.json         # maxDuration функции
└── .env.example        # шаблон переменных окружения
```

Зависимостей нет: только встроенные возможности Node.js.

## Что делает функция

| Защита | Как реализована |
|---|---|
| CORS | Принимает запросы только с адресов из `ALLOWED_ORIGINS` (без учёта регистра), остальным `403` |
| Валидация | Имя 2–80 символов, телефон 7–20 символов (цифры, `+ - ( )`), «о себе» до 1000; управляющие символы вырезаются |
| Боты | Скрытое поле `website`: если заполнено, заявка тихо отбрасывается |
| Частота | Не больше 5 запросов в минуту с одного IP. Это приблизительная защита (счётчик в памяти экземпляра функции); дополнительно можно настроить правила в Vercel Firewall |
| Размер | Тело запроса до 8 КБ, иначе `413` |
| Секреты | Токен бота и chat id хранятся в переменных окружения Vercel, в репозитории их нет и в логи они не попадают |
| Инъекции | Сообщение уходит обычным текстом (без `parse_mode`), разметка Telegram не интерпретируется |
| Таймаут | Запрос к Telegram прерывается через 8 секунд |

> Заявка содержит персональные данные (имя, телефон). Функция их **не хранит**: они проходят через Vercel и попадают в Telegram-чат.

## Развёртывание

### 1. Telegram-бот

1. Откройте [@BotFather](https://t.me/BotFather), выполните `/newbot` и сохраните токен.
2. Напишите своему боту любое сообщение (или добавьте бота в чат волонтёров и напишите в чат).
3. Откройте в браузере `https://api.telegram.org/bot<ТОКЕН>/getUpdates` и найдите `"chat":{"id": ...}`. Это `TELEGRAM_CHAT_ID` (для групп число отрицательное).

### 2. Проект на Vercel

1. Зарегистрируйтесь на [vercel.com](https://vercel.com) через GitHub (тариф Hobby, карта не нужна).
2. **Add New → Project** → выберите репозиторий `khvostiki-portfolio`.
3. В настройках импорта:
   - **Root Directory:** `server`
   - **Framework Preset:** Other (сборка не нужна)
4. В разделе **Environment Variables** добавьте три переменные:

   | Имя | Значение |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | токен от @BotFather |
   | `TELEGRAM_CHAT_ID` | id чата |
   | `ALLOWED_ORIGINS` | `https://simakogan.github.io` |

5. Нажмите **Deploy**. Адрес функции будет `https://<проект>.vercel.app/api/apply`.

Проверка: откройте этот адрес в браузере, должно вернуться `{"ok":true,"service":"khvostiki-adopt-api"}`.

Дальше каждый push в `main` автоматически обновляет функцию.

### 3. Подключение к сайту

В репозитории на GitHub: `Settings → Secrets and variables → Actions → Variables → New repository variable`:
имя `API_URL`, значение: **полный адрес функции** `https://<проект>.vercel.app/api/apply`.
Затем запустите workflow **Deploy to GitHub Pages** (Actions → Run workflow). Форма начнёт отправлять заявки на сервер.

## Локальная разработка

Из корня репозитория одной командой запускаются сайт и API:

```bash
npm run dev     # сайт http://localhost:8080, API http://localhost:8787/api/apply
```

При первом запуске создаётся `server/.env.local` из примера. Впишите туда настоящие токен и chat id, чтобы проверить доставку в Telegram. Только тесты API:

```bash
cd server && npm test
```

Проверка запросом (заголовок `Origin` обязателен и должен быть в `ALLOWED_ORIGINS`):

```bash
curl -i -X POST http://localhost:8787/api/apply \
  -H 'Origin: http://localhost:8080' -H 'Content-Type: application/json' \
  -d '{"name":"Анна","phone":"+7 900 000-12-34","pet":"Рокси"}'
```

## Ответы API

| Код | `error` | Когда |
|---|---|---|
| 200 | | заявка отправлена |
| 400 / 413 / 415 | `invalid_json` / `payload_too_large` / `unsupported_media_type` | некорректный запрос |
| 403 | `origin_not_allowed` | запрос с чужого сайта |
| 422 | `validation_failed` | ошибки в полях (`fields` указывает в каких) |
| 429 | `rate_limited` | слишком много запросов |
| 502 | `telegram_error` / `telegram_unreachable` | не удалось доставить в Telegram |
