# versaAI

The unfiltered AI companion. Multi-persona chat with voice, memory, and zero filter.

This repository holds the static landing page for versaAI:

- `index.html` — landing page (hero, demo, personas, features, waitlist, FAQ)
- `public.css` — styles (dark/neon theme)
- `public.js` — age gate, animated mascot, demo chat, waitlist form

## 18+ only

versaAI is intended for adults. The landing page includes a first-visit age gate (stored in `localStorage` under `versaai.age.confirmed`). All personas are fictional and depicted as 18 or older. We do not allow content involving minors, real-person impersonation, harassment, or illegal activity.

## Local preview

Any static file server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy

Static site — drop the three files at the root and deploy to GitHub Pages, Cloudflare Pages, Netlify, or Vercel. No build step.

## What's next

The current site is marketing-only. The chat backend (model routing, persona system prompts, voice, memory) is the next milestone — see issues / project board.
