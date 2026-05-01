# versaAI

The unfiltered AI companion. Multi-persona chat with voice, memory, and zero filter.

This repo contains:

- **Static site** — `index.html` (landing) + `chat.html` (chat UI) + `public.css` / `public.js` / `chat.css` / `chat.js`
- **Backend** — `worker/` Cloudflare Worker exposing `POST /api/chat`
  (Anthropic Messages API, streaming SSE) and `POST /api/tts`
  (ElevenLabs text-to-speech, streaming MP3) with persona-specific system
  prompts and per-persona voice IDs.

## 18+ only

versaAI is intended for adults. Both pages run a first-visit age gate (stored
in `localStorage` under `versaai.age.confirmed`). All personas are fictional
and depicted as 18 or older. We do not allow content involving minors,
real-person impersonation, harassment, or illegal activity.

## Personas

Four characters, each with their own system prompt baked into the worker:

- **Versa** — chaos default, sharp-tongued, brutally honest
- **Nyx** — late-night confidant, soft and conspiratorial
- **Ozzy** — the bad coach, all caps and gym energy
- **Saint** — deeply unsaintly, charming and a menace

Edit `worker/personas.js` to tune voice or add new personas. Add the matching
pill in `chat.html` and the gradient swatch in `public.css` if you do.

## Run locally

You need two processes: the static site and the Worker.

```bash
# 1. Worker (chat + tts backend) — port 8787 by default
cd worker
npx wrangler secret put ANTHROPIC_API_KEY      # required
npx wrangler secret put ELEVENLABS_API_KEY     # optional, for voice replies
npx wrangler dev

# 2. Static site — port 8000
cd ..
python3 -m http.server 8000
```

Open `http://localhost:8000/`. The chat page hits `/api/chat` and `/api/tts`
on the same origin by default. In local dev, append
`?api=http://localhost:8787` to the chat URL so the browser talks to the
Worker on its own port for both endpoints.

## Deploy

**Static site** — drop the HTML/CSS/JS at the root and push to GitHub Pages,
Cloudflare Pages, Netlify, or Vercel. No build step.

**Worker** — from the `worker/` directory:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY  # optional
npx wrangler deploy
```

If you host both behind the same domain (Cloudflare Pages + Workers route, or
the same Vercel project), the chat page's default `/api/*` paths work as-is.
Otherwise change the `apiBase` resolution in `chat.js` to point at the Worker
URL.

## Model + voice

The Worker calls `claude-opus-4-7` with thinking disabled (chat is about
personality, not multi-step reasoning) and a 1024 token cap per response.
Adjust `MODEL` and `MAX_TOKENS` in `worker/index.js` if you want to swap.

For voice, the Worker proxies to ElevenLabs `eleven_turbo_v2_5` using the
voice ID configured per persona in `worker/personas.js`. Defaults are
ElevenLabs shared-library voices (Rachel / Bella / Adam / Antoni); replace
with your own cloned voices for unique-feeling characters. If the
`ELEVENLABS_API_KEY` secret isn't set, `/api/tts` returns 503 and the client
silently falls back to the browser's `SpeechSynthesis` API.

## Safety notes

The persona system prompts include a non-negotiable safety preamble: no
content involving minors, no real-person sexualization or harassment, no
operational instructions for violence / self-harm / weapons / illegal acts,
crisis-aware refusals. Keep these in any new persona you add.
