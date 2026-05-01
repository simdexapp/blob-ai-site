# versaAI

The unfiltered AI companion. Multi-persona chat with voice, memory, and zero filter.

This repo is a single Node service that serves both the static site and the
chat backend:

- **Static site** — `index.html` (landing) + `chat.html` (chat UI) +
  `public.css` / `public.js` / `chat.css` / `chat.js`, served from the repo root.
- **Backend** — `server/index.js`, a small `node:http` server with two routes:
  - `POST /api/chat` — proxies to the Anthropic Messages API (streaming SSE)
    with persona-specific system prompts.
  - `POST /api/tts` — proxies to ElevenLabs (streaming MP3) with per-persona
    voice IDs.
- `server/personas.js` — persona definitions: voice, system prompt, ElevenLabs
  voice ID + voice settings.

No build step. No bundler. No dependencies — Node 22's native `fetch` and
`Readable.fromWeb` are doing the lifting.

## 18+ only

versaAI is intended for adults. Both pages run a first-visit age gate (stored
in `localStorage` under `versaai.age.confirmed`). All personas are fictional
and depicted as 18 or older. We do not allow content involving minors,
real-person impersonation, harassment, or illegal activity.

## Personas

Four characters, each with their own system prompt:

- **Versa** — chaos default, sharp-tongued, brutally honest
- **Nyx** — late-night confidant, soft and conspiratorial
- **Ozzy** — the bad coach, all caps and gym energy
- **Saint** — deeply unsaintly, charming and a menace

Edit `server/personas.js` to tune voice or add new personas. Add the matching
pill in `chat.html` and the gradient swatch in `public.css` if you do.

## Run locally

Requires Node 22+. From the repo root:

```bash
cp .env.example .env
# edit .env: set ANTHROPIC_API_KEY (required) and ELEVENLABS_API_KEY (optional)

npm start
# server listens on http://localhost:3000

# Or with auto-reload during development:
npm run dev
```

Open `http://localhost:3000/`. The chat page hits `/api/chat` and `/api/tts`
on the same origin — no flags or query params needed.

> Note: `npm start` and `npm run dev` need `.env` to be loaded into the
> environment. On Node 22, that's automatic with the experimental `--env-file`
> flag — if you prefer not to use `.env`, just export `ANTHROPIC_API_KEY` (and
> optionally `ELEVENLABS_API_KEY`) into the shell before running.

## Deploy to Railway

1. Push your repo to GitHub.
2. railway.com → New Project → Deploy from GitHub Repo → pick this repo.
3. Project Settings → Variables: add `ANTHROPIC_API_KEY` (and
   `ELEVENLABS_API_KEY` if you want voice). Railway sets `PORT` automatically.
4. Railway auto-detects `package.json`, runs `npm install` (no-op, no deps),
   runs `npm start`. You get a public `*.up.railway.app` URL.

That's it — one service hosts the static site and the API on the same URL.

## Deploy elsewhere

The server is plain Node + native `fetch`, so it runs anywhere Node does. A
non-exhaustive list:

- **Fly.io** — `fly launch` (auto-generates a `fly.toml`), `fly secrets set
  ANTHROPIC_API_KEY=...`, `fly deploy`.
- **Render** — Web Service, build command empty, start command `npm start`.
- **A VPS** — `npm start` behind Caddy/nginx for TLS. Cheapest, most control.
- **Vercel / Netlify** — both work but the chat code would move from
  `server/index.js` into a serverless / edge function (one route per file).
  Less ideal for streaming SSE on cold starts; better suited to platforms with
  long-lived processes.

## Model + voice

The server calls `claude-opus-4-7` with thinking disabled (chat is about
personality, not multi-step reasoning) and a 1024-token cap per response.
Adjust `MODEL` and `MAX_TOKENS` in `server/index.js` to swap.

For voice, the server proxies to ElevenLabs `eleven_turbo_v2_5` using the
voice ID configured per persona in `server/personas.js`. Defaults are
ElevenLabs shared-library voices (Rachel / Bella / Adam / Antoni); replace
with cloned voices for unique-feeling characters. If `ELEVENLABS_API_KEY`
isn't set, `/api/tts` returns 503 and the client silently falls back to the
browser's `SpeechSynthesis` API.

## Safety notes

The persona system prompts include a non-negotiable safety preamble: no
content involving minors, no real-person sexualization or harassment, no
operational instructions for violence / self-harm / weapons / illegal acts,
crisis-aware refusals. Keep these in any new persona you add.
