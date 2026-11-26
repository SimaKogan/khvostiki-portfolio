/**
 * Ядро API заявок на усыновление. Работает на стандартных Request/Response,
 * поэтому не зависит от платформы и легко тестируется.
 *
 * Переменные окружения:
 *   ALLOWED_ORIGINS     список разрешённых источников через запятую
 *   TELEGRAM_BOT_TOKEN  токен бота от @BotFather
 *   TELEGRAM_CHAT_ID    id чата, куда присылать заявки
 */
import { validateApplication, formatMessage } from "./validate.js";
import { createRateLimiter } from "./rate-limit.js";

const MAX_BODY_BYTES = 8 * 1024;
const defaultLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, "").toLowerCase())
    .filter(Boolean);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders },
  });
}

function clientKey(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip")) || "anonymous";
}

/**
 * @param {Request} request
 * @param {Record<string, string | undefined>} env
 * @param {{ fetch?: typeof fetch, limiter?: { check(key: string): boolean } }} [deps] подменяются в тестах
 */
export async function handle(request, env, deps = {}) {
  const fetchImpl = deps.fetch ?? fetch;
  const limiter = deps.limiter ?? defaultLimiter;

  /* Проверка работоспособности: открытый GET без Origin */
  if (request.method === "GET") return json(200, { ok: true, service: "khvostiki-adopt-api" });

  const origin = (request.headers.get("Origin") || "").replace(/\/$/, "").toLowerCase();
  if (!origin || !allowedOrigins(env).includes(origin)) {
    return json(403, { ok: false, error: "origin_not_allowed" });
  }
  const cors = corsHeaders(origin);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" }, cors);

  if (!(request.headers.get("Content-Type") || "").includes("application/json")) {
    return json(415, { ok: false, error: "unsupported_media_type" }, cors);
  }

  if (!limiter.check(clientKey(request))) {
    return json(
      429,
      { ok: false, error: "rate_limited", message: "Слишком много попыток. Подождите минуту и попробуйте снова." },
      cors
    );
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return json(413, { ok: false, error: "payload_too_large" }, cors);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: "invalid_json" }, cors);
  }

  const checked = validateApplication(data);
  if (!checked.ok) {
    return json(
      422,
      { ok: false, error: checked.error, fields: checked.fields, message: "Проверьте имя и телефон: похоже, в них ошибка." },
      cors
    );
  }
  /* Боту отвечаем «успех», чтобы он не искал обход, но ничего не пересылаем. */
  if (checked.spam) return json(200, { ok: true }, cors);

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID не заданы");
    return json(500, { ok: false, error: "server_misconfigured" }, cors);
  }

  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: formatMessage(checked.value),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("Telegram вернул статус", res.status); /* токен в лог не пишем */
      return json(502, { ok: false, error: "telegram_error" }, cors);
    }
  } catch (err) {
    console.error("Не удалось связаться с Telegram:", err && err.name);
    return json(502, { ok: false, error: "telegram_unreachable" }, cors);
  }

  return json(200, { ok: true }, cors);
}
