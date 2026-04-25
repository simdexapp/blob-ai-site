# blob.ai public site

This folder is the static public website for blob.ai.

Publish only these files when making a public website:

- `index.html`
- `public.css`
- `public.js`

Do not publish the local agent server, `.env`, `.agent`, memory database, or workspace files unless you intentionally want the whole project source public.

## GitHub Pages

Fast path:

1. Create a public GitHub repository for the website, such as `blob-ai-site`.
2. Upload the contents of this folder to the repository root.
3. In GitHub, open Settings -> Pages.
4. Set Source to `Deploy from a branch`.
5. Pick branch `main` and folder `/root`.

The site can also deploy to Cloudflare Pages, Netlify, or Vercel as a static site with this folder as the publish directory.
