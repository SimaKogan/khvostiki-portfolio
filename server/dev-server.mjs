/**
 * Локальный запуск функции без Vercel CLI и без входа в аккаунт.
 * Повторяет то, что делает Vercel: разбирает JSON в req.body и даёт res.status()/res.send().
 *   node --env-file=.env.local dev-server.mjs
 */
import http from "node:http";
import handler from "./api/apply.js";

const PORT = Number(process.env.API_PORT || 8787);

http
  .createServer(async (req, res) => {
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (obj) => (res.setHeader("Content-Type", "application/json; charset=utf-8"), res.end(JSON.stringify(obj)));
    res.send = (data) => res.end(data);

    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname !== "/api/apply" && pathname !== "/") {
      res.status(404).json({ ok: false, error: "not_found" });
      return;
    }

    if (!req.headers["x-forwarded-for"] && req.socket.remoteAddress) {
      req.headers["x-forwarded-for"] = req.socket.remoteAddress;
    }

    let raw = "";
    for await (const chunk of req) raw += chunk;
    const type = req.headers["content-type"] || "";
    try {
      req.body = type.includes("application/json") && raw ? JSON.parse(raw) : raw;
    } catch {
      res.status(400).json({ ok: false, error: "invalid_json" });
      return;
    }

    try {
      await handler(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log(`  API:   http://localhost:${PORT}/api/apply`));
