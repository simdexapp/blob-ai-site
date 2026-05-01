# versaAI

The unfiltered AI companion. Multi-persona chat with voice, memory, and zero filter.

This repo contains:

- **Static site** — `index.html` (landing) + `chat.html` (chat UI) + `public.css` / `public.js` / `chat.css` / `chat.js`
- **Backend** — `worker/` Cloudflare Worker that proxies chat requests to the
  Anthropic Messages API with persona-specific system prompts and SSE streaming.

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
# 1. Worker (chat backend) — port 8787 by default
cd worker
npx wrangler secret put ANTHROPIC_API_KEY  # paste key, hit enter
npx wrangler dev

# 2. Static site — port 8000
cd ..
python3 -m http.server 8000
```

Open `http://localhost:8000/`. The chat page hits `/api/chat` by default; in
local dev, append `?api=http://localhost:8787/api/chat` to the chat URL so the
browser talks to the Worker on its own port.

## Deploy

**Static site** — drop the HTML/CSS/JS at the root and push to GitHub Pages,
Cloudflare Pages, Netlify, or Vercel. No build step.

**Worker** — from the `worker/` directory:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```

If you host both behind the same domain (Cloudflare Pages + Workers route, or
the same Vercel project), the chat page's default `/api/chat` works as-is.
Otherwise edit `DEFAULT_API` in `chat.js` to point at the Worker URL.

## Model

The Worker calls `claude-opus-4-7` with thinking disabled (chat is about
personality, not multi-step reasoning) and a 1024 token cap per response.
Adjust `MODEL` and `MAX_TOKENS` in `worker/index.js` if you want to swap.

## Safety notes

The persona system prompts include a non-negotiable safety preamble: no
content involving minors, no real-person sexualization or harassment, no
operational instructions for violence / self-harm / weapons / illegal acts,
crisis-aware refusals. Keep these in any new persona you add.
