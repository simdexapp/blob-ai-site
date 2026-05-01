import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { getPersona } from "./personas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 1024;

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";
const ELEVENLABS_MODEL = "eleven_turbo_v2_5";
const TTS_MAX_CHARS = 1500;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// Whitelist of static files we'll serve, mapped to MIME type. Anything not in
// this map (e.g. package.json, README.md, server/) returns 404 even if it
// exists on disk.
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function jsonError(res, status, message) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...CORS_HEADERS,
  });
  res.end(JSON.stringify({ error: message }));
}

async function readJsonBody(req, limit = 1_000_000) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) {
      const err = new Error("payload too large");
      err.code = "PAYLOAD_TOO_LARGE";
      throw err;
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleChat(req, res) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError(res, 500, "server is missing ANTHROPIC_API_KEY");
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    if (err.code === "PAYLOAD_TOO_LARGE") return jsonError(res, 413, "payload too large");
    return jsonError(res, 400, "invalid JSON");
  }

  const { persona: personaId, messages } = body;
  const persona = getPersona(personaId);
  if (!persona) return jsonError(res, 400, "unknown persona");
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError(res, 400, "messages must be a non-empty array");
  }
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return jsonError(res, 400, "each message needs role: user|assistant and content: string");
    }
  }

  const upstream = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      stream: true,
      thinking: { type: "disabled" },
      system: persona.system,
      messages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return jsonError(res, upstream.status || 502, text || "upstream error");
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    ...CORS_HEADERS,
  });
  Readable.fromWeb(upstream.body).pipe(res);
}

async function handleTts(req, res) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return jsonError(res, 503, "tts disabled: server missing ELEVENLABS_API_KEY");
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    if (err.code === "PAYLOAD_TOO_LARGE") return jsonError(res, 413, "payload too large");
    return jsonError(res, 400, "invalid JSON");
  }

  const { persona: personaId, text } = body;
  const persona = getPersona(personaId);
  if (!persona || !persona.voiceId) {
    return jsonError(res, 400, "unknown persona or persona has no voice configured");
  }
  if (typeof text !== "string" || !text.trim()) {
    return jsonError(res, 400, "text must be a non-empty string");
  }

  const trimmed = text.length > TTS_MAX_CHARS ? text.slice(0, TTS_MAX_CHARS) : text;

  const upstream = await fetch(`${ELEVENLABS_BASE}/${persona.voiceId}/stream`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: trimmed,
      model_id: ELEVENLABS_MODEL,
      voice_settings: persona.voiceSettings || undefined,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    return jsonError(res, upstream.status || 502, errText || "tts upstream error");
  }

  res.writeHead(200, {
    "Content-Type": "audio/mpeg",
    "Cache-Control": "no-store",
    ...CORS_HEADERS,
  });
  Readable.fromWeb(upstream.body).pipe(res);
}

async function handleStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://_").pathname);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("bad request");
  }
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

  // Single-level only — no nested paths, no traversal, no hidden files.
  const filename = urlPath.replace(/^\//, "");
  if (filename.includes("/") || filename.includes("..") || filename.startsWith(".")) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("not found");
  }

  const ext = extname(filename).toLowerCase();
  if (!MIME[ext]) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("not found");
  }

  try {
    const data = await readFile(join(STATIC_DIR, filename));
    res.writeHead(200, {
      "Content-Type": MIME[ext],
      "Cache-Control": "public, max-age=300",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS);
      return res.end();
    }

    const url = new URL(req.url, "http://_");
    if (url.pathname === "/api/chat") {
      if (req.method !== "POST") return jsonError(res, 405, "method not allowed");
      return handleChat(req, res);
    }
    if (url.pathname === "/api/tts") {
      if (req.method !== "POST") return jsonError(res, 405, "method not allowed");
      return handleTts(req, res);
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return jsonError(res, 405, "method not allowed");
    }
    return handleStatic(req, res);
  } catch (err) {
    console.error("server error", err);
    if (!res.headersSent) jsonError(res, 500, "internal error");
    else res.destroy();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`versaAI server listening on http://${HOST}:${PORT}`);
});
