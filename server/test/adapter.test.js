import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/apply.js";

/* Имитация req/res, которые Vercel передаёт в Node.js-функцию */
function makeRes() {
  const res = { statusCode: 200, headers: {}, chunks: [] };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (o) => ((res.headers["content-type"] = "application/json"), (res.chunks.push(Buffer.from(JSON.stringify(o)))), res);
  res.setHeader = (k, v) => (res.headers[k.toLowerCase()] = v);
  res.send = (b) => (res.chunks.push(Buffer.from(b)), res);
  Object.defineProperty(res, "text", { get: () => Buffer.concat(res.chunks).toString("utf8") });
  return res;
}
const baseHeaders = { host: "api.example.vercel.app", "x-forwarded-proto": "https", "x-forwarded-for": "198.51.100.9" };

test("GET /api/apply отвечает проверкой работоспособности", async () => {
  const res = makeRes();
  await handler({ method: "GET", url: "/api/apply", headers: baseHeaders }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.text).service, "khvostiki-adopt-api");
});

test("OPTIONS для чужого origin: 403 с JSON-ответом", async () => {
  const res = makeRes();
  await handler({ method: "OPTIONS", url: "/api/apply", headers: { ...baseHeaders, origin: "https://evil.example" } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(JSON.parse(res.text).error, "origin_not_allowed");
});

test("POST с телом, уже разобранным Vercel в объект: доходит до валидации (422)", async () => {
  process.env.ALLOWED_ORIGINS = "https://user.github.io";
  const res = makeRes();
  await handler(
    { method: "POST", url: "/api/apply", headers: { ...baseHeaders, origin: "https://user.github.io", "content-type": "application/json" }, body: { name: "", phone: "x" } },
    res
  );
  assert.equal(res.statusCode, 422);
  assert.equal(res.headers["access-control-allow-origin"], "https://user.github.io");
});

test("POST со строковым телом (битый JSON): 400", async () => {
  process.env.ALLOWED_ORIGINS = "https://user.github.io";
  const res = makeRes();
  await handler(
    { method: "POST", url: "/api/apply", headers: { ...baseHeaders, origin: "https://user.github.io", "content-type": "application/json" }, body: "{не json" },
    res
  );
  assert.equal(res.statusCode, 400);
});

test("исключение при чтении req.body (битый JSON у Vercel): 400", async () => {
  const req = { method: "POST", url: "/api/apply", headers: { ...baseHeaders, "content-type": "application/json" } };
  Object.defineProperty(req, "body", { get() { throw new SyntaxError("bad"); } });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
});
