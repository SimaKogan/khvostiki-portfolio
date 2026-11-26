import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../lib/handle.js";

const ORIGIN = "https://user.github.io";
const env = { ALLOWED_ORIGINS: `${ORIGIN}/`, TELEGRAM_BOT_TOKEN: "123:SECRET", TELEGRAM_CHAT_ID: "42" };
const body = { name: "Анна", phone: "+7 900 000-12-34", pet: "Рокси", msg: "" };
const open = { check: () => true };

function req(method, payload, headers = {}) {
  return new Request("https://api.example.vercel.app/api/apply", {
    method,
    headers: { Origin: ORIGIN, "Content-Type": "application/json", ...headers },
    body: payload === undefined ? undefined : typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

function fakeFetch(status = 200) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return new Response("{}", { status });
  };
  fn.calls = calls;
  return fn;
}
const deps = (f = fakeFetch(), limiter = open) => ({ fetch: f, limiter });

test("GET отвечает проверкой работоспособности", async () => {
  const res = await handle(new Request("https://api.example.vercel.app/api/apply"), env, deps());
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
});

test("чужой Origin получает 403", async () => {
  const res = await handle(req("POST", body, { Origin: "https://evil.example" }), env, deps());
  assert.equal(res.status, 403);
});

test("запрос без Origin получает 403", async () => {
  const r = new Request("https://api.example.vercel.app/api/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await handle(r, env, deps())).status, 403);
});

test("preflight OPTIONS возвращает CORS-заголовки", async () => {
  const res = await handle(req("OPTIONS"), env, deps());
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
});

test("origin сравнивается без учёта регистра (логин GitHub с заглавными буквами)", async () => {
  const mixed = { ...env, ALLOWED_ORIGINS: "https://SimaKogan.github.io" };
  const res = await handle(req("POST", body, { Origin: "https://simakogan.github.io" }), mixed, deps());
  assert.equal(res.status, 200);
});

test("успешная заявка уходит в Telegram с нужными данными", async () => {
  const f = fakeFetch();
  const res = await handle(req("POST", body), env, deps(f));
  assert.equal(res.status, 200);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, "https://api.telegram.org/bot123:SECRET/sendMessage");
  const sent = JSON.parse(f.calls[0].init.body);
  assert.equal(sent.chat_id, "42");
  assert.match(sent.text, /Имя: Анна/);
});

test("невалидные данные: 422 и ничего не отправляется", async () => {
  const f = fakeFetch();
  const res = await handle(req("POST", { name: "", phone: "x" }), env, deps(f));
  assert.equal(res.status, 422);
  assert.equal(f.calls.length, 0);
});

test("бот с заполненной ловушкой получает 200, но в Telegram ничего не уходит", async () => {
  const f = fakeFetch();
  const res = await handle(req("POST", { ...body, website: "spam" }), env, deps(f));
  assert.equal(res.status, 200);
  assert.equal(f.calls.length, 0);
});

test("ошибка Telegram превращается в 502 без утечки токена", async () => {
  const res = await handle(req("POST", body), env, deps(fakeFetch(500)));
  assert.equal(res.status, 502);
  assert.doesNotMatch(await res.text(), /SECRET/);
});

test("сетевой сбой при обращении к Telegram: 502", async () => {
  const boom = async () => { throw new TypeError("network"); };
  const res = await handle(req("POST", body), env, { fetch: boom, limiter: open });
  assert.equal(res.status, 502);
});

test("битый JSON: 400", async () => {
  assert.equal((await handle(req("POST", "{не json"), env, deps())).status, 400);
});

test("неверный Content-Type: 415", async () => {
  const res = await handle(req("POST", JSON.stringify(body), { "Content-Type": "text/plain" }), env, deps());
  assert.equal(res.status, 415);
});

test("слишком большое тело: 413", async () => {
  const res = await handle(req("POST", { ...body, msg: "я".repeat(9000) }), env, deps());
  assert.equal(res.status, 413);
});

test("метод не POST: 405", async () => {
  assert.equal((await handle(req("PUT", body), env, deps())).status, 405);
});

test("лимитер: 429 и ничего не отправляется; ключ берётся из x-forwarded-for", async () => {
  const f = fakeFetch();
  const keys = [];
  const limiter = { check: (k) => (keys.push(k), false) };
  const res = await handle(req("POST", body, { "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), env, deps(f, limiter));
  assert.equal(res.status, 429);
  assert.equal(f.calls.length, 0);
  assert.deepEqual(keys, ["203.0.113.7"]);
});

test("нет секретов Telegram: 500", async () => {
  const res = await handle(req("POST", body), { ALLOWED_ORIGINS: ORIGIN }, deps());
  assert.equal(res.status, 500);
});
