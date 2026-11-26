import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../lib/rate-limit.js";

test("пропускает не больше limit запросов за окно", () => {
  let t = 0;
  const rl = createRateLimiter({ limit: 3, windowMs: 1000, now: () => t });
  assert.deepEqual([1, 2, 3, 4].map(() => rl.check("ip")), [true, true, true, false]);
});

test("после окончания окна доступ восстанавливается", () => {
  let t = 0;
  const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
  assert.equal(rl.check("ip"), true);
  assert.equal(rl.check("ip"), false);
  t = 1001;
  assert.equal(rl.check("ip"), true);
});

test("разные ключи считаются независимо", () => {
  const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
  assert.equal(rl.check("a"), true);
  assert.equal(rl.check("b"), true);
});

test("память ограничена maxKeys", () => {
  const rl = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 10, now: () => 0 });
  for (let i = 0; i < 100; i++) rl.check("ip" + i);
  /* старые ключи вытеснены: самый первый снова пропускается */
  assert.equal(rl.check("ip0"), true);
});
