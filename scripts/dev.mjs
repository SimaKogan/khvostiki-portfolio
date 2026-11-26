#!/usr/bin/env node
/**
 * Локальный запуск всего проекта одной командой: npm run dev
 *   - сайт:    http://localhost:8080  (статический сервер без зависимостей)
 *   - API:     http://localhost:8787/api/apply  (Vercel Function, локальный запуск без Vercel CLI)
 * Форма на локальной странице автоматически направлена на локальный API.
 * Работает на Windows, macOS и Linux.
 */
import http from "node:http";
import { spawn } from "node:child_process";
import { readFile, copyFile, access } from "node:fs/promises";
import { join, extname, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SITE = join(ROOT, "site");
const SERVER = join(ROOT, "server");
const SITE_PORT = Number(process.env.SITE_PORT || 8080);
const API_PORT = Number(process.env.API_PORT || 8787);

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm",
};

/* ---------- 1. Статический сервер ---------- */
const server = http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(SITE, path));
    if (file !== SITE && !file.startsWith(SITE + sep)) { res.writeHead(403).end("Forbidden"); return; }
    let body = await readFile(file);
    const type = MIME[extname(file).toLowerCase()] || "application/octet-stream";
    if (type.startsWith("text/html") || file.endsWith(".xml") || file.endsWith("robots.txt")) {
      body = Buffer.from(
        body.toString("utf8")
          .replaceAll("__SITE_URL__", `http://localhost:${SITE_PORT}`)
          .replace('data-endpoint=""', `data-endpoint="http://localhost:${API_PORT}/api/apply"`)
      );
    }
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" }).end(body);
  } catch {
    try {
      const nf = (await readFile(join(SITE, "404.html"), "utf8")).replaceAll("__SITE_URL__", `http://localhost:${SITE_PORT}`);
      res.writeHead(404, { "Content-Type": MIME[".html"] }).end(nf);
    } catch { res.writeHead(404).end("Not found"); }
  }
});
server.listen(SITE_PORT, () => console.log(`\n  Сайт:  http://localhost:${SITE_PORT}`));

/* ---------- 2. API (Vercel Function) ---------- */
const exists = (p) => access(p).then(() => true, () => false);
if (!(await exists(join(SERVER, ".env.local")))) {
  await copyFile(join(SERVER, ".env.example"), join(SERVER, ".env.local"));
  console.log("  Создан server/.env.local из примера. Впишите туда настоящие TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID,");
  console.log("  чтобы заявки реально приходили в Telegram. Пока значения-заглушки: форма покажет запасной вариант.");
}

const api = spawn(process.execPath, ["--env-file=.env.local", "dev-server.mjs"], {
  cwd: SERVER, stdio: "inherit", env: { ...process.env, API_PORT: String(API_PORT) },
});
api.on("exit", (code) => { server.close(); process.exit(code ?? 0); });

const stop = () => { api.kill(); server.close(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
