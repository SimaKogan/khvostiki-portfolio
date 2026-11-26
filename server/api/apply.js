/**
 * Vercel Function (Node.js): POST /api/apply
 * Тонкий адаптер: превращает req/res Vercel в стандартные Request/Response
 * и отдаёт работу ядру из lib/handle.js.
 */
import { handle } from "../lib/handle.js";

function readBody(req) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return undefined;
  const body = req.body; /* Vercel разбирает JSON по Content-Type */
  if (body === undefined || body === null) return "";
  if (typeof body === "string") return body;
  if (Buffer.isBuffer(body)) return body.toString("utf8");
  return JSON.stringify(body);
}

export default async function handler(req, res) {
  let body;
  try {
    body = readBody(req); /* на битом JSON Vercel бросает исключение при обращении к req.body */
  } catch {
    res.status(400).json({ ok: false, error: "invalid_json" });
    return;
  }

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value != null) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  const proto = req.headers["x-forwarded-proto"] || "https";
  const request = new Request(`${proto}://${req.headers.host || "localhost"}${req.url}`, {
    method: req.method,
    headers,
    body,
  });

  const response = await handle(request, process.env);
  res.status(response.status);
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.send(Buffer.from(await response.arrayBuffer()));
}
