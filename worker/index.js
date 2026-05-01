import { getPersona } from "./personas.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 1024;

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";
const ELEVENLABS_MODEL = "eleven_turbo_v2_5"; // fast, cheap, good for chat
const TTS_MAX_CHARS = 1500;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return jsonError(405, "method not allowed");
    }

    if (url.pathname === "/api/chat") {
      return handleChat(request, env);
    }
    if (url.pathname === "/api/tts") {
      return handleTts(request, env);
    }
    return jsonError(404, "not found");
  },
};

async function handleChat(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonError(500, "server is missing ANTHROPIC_API_KEY");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid JSON");
  }

  const { persona: personaId, messages } = body;
  const persona = getPersona(personaId);
  if (!persona) {
    return jsonError(400, "unknown persona");
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError(400, "messages must be a non-empty array");
  }
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return jsonError(400, "each message needs role: user|assistant and content: string");
    }
  }

  const upstream = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
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
    return jsonError(upstream.status || 502, text || "upstream error");
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      ...CORS_HEADERS,
    },
  });
}

async function handleTts(request, env) {
  if (!env.ELEVENLABS_API_KEY) {
    return jsonError(503, "tts disabled: server missing ELEVENLABS_API_KEY");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid JSON");
  }

  const { persona: personaId, text } = body;
  const persona = getPersona(personaId);
  if (!persona || !persona.voiceId) {
    return jsonError(400, "unknown persona or persona has no voice configured");
  }
  if (typeof text !== "string" || !text.trim()) {
    return jsonError(400, "text must be a non-empty string");
  }

  const trimmed = text.length > TTS_MAX_CHARS ? text.slice(0, TTS_MAX_CHARS) : text;

  const upstream = await fetch(`${ELEVENLABS_BASE}/${persona.voiceId}/stream`, {
    method: "POST",
    headers: {
      "xi-api-key": env.ELEVENLABS_API_KEY,
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
    return jsonError(upstream.status || 502, errText || "tts upstream error");
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}
