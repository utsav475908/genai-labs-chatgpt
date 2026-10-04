# GenAI Labs showcase

One React app that presents every lab in this repo, one after another. Each lab keeps its own
FastAPI backend and its own Next.js UI; the showcase shows that UI inside a frame, with a sidebar,
Lab N of M, previous/next links and an API health badge.

**[`config/labs.json`](config/labs.json) is the only file you edit.** The UI reads it at runtime
and re-reads it every `refreshSeconds`, so renaming, reordering, describing or hiding a lab shows
up in the open page without a rebuild.

## How it fits together

```
                    showcase/config/labs.json   (the one config file)
                               │ fetched by the browser at runtime
 https://DOMAIN ───────────────▼────────────────────────────────────────────────
   React shell (showcase/shell)   sidebar · Lab N of M · health badge · <iframe>
        │ iframe                         │ health check
        ▼                                ▼
 https://v10.DOMAIN               https://DOMAIN/api/v10/ ─┐
   lab's own Next.js UI (static)                           │
   └─ calls /api/... ── same origin, no CORS ──────────────┤
                                                           ▼
                                          FastAPI backend of lab v10 (:8010)
```

- **Labs are unchanged** apart from one line in each `frontend/app/page.js`: the backend URL now
  reads `process.env.NEXT_PUBLIC_API_URL` and falls back to the old `http://localhost:80xx`, so
  local development works exactly as before.
- **Backends are unchanged.** In deployment each lab's UI and API share one origin
  (`vN.DOMAIN` and `vN.DOMAIN/api`), so their existing CORS settings don't matter.
- **Secrets live in one root `.env`** (see [`../.env.example`](../.env.example)). Locally every
  backend's `load_dotenv()` finds it by walking up from its folder; in deployment Docker Compose
  hands it to every backend container. It is git-ignored and excluded from every Docker image.

## labs.json

```jsonc
{
  "title": "GenAI Labs",
  "refreshSeconds": 30,                 // 0 turns off live reload; otherwise at least 5
  "labs": [                             // array order = presentation order
    {
      "id": "v10",                      // URL slug and subdomain: lowercase, digits, dashes
      "name": "Advanced RAG Lab",
      "description": "…",
      "dir": "chatbot-v10-Advanced-RAG-Lab",
      "backendDir": "backend",          // default "backend"; "." when main.py is in the lab root
      "backendPort": 8010,
      "frontendPort": 3010,             // default 3000; only used for local development
      "enabled": true,                  // default true; false hides the lab
      "healthPath": "/",                // default "/"
      "persist": ["genai_labs.db"]      // deployment: SQLite files kept on the server across redeploys
    }
  ]
}
```

Optional `frontendUrl` / `apiUrl` override where a lab is loaded from.

| Change | What to do |
|---|---|
| Rename, describe, reorder, hide a lab | Edit `labs.json`. The open UI updates on its next refresh. |
| Add a new lab, or deploy one that was disabled | Add or enable it in `labs.json`, then run `deploy.sh` once to build and route it. |

## Local development

Run the labs the way you always have (backend with `uvicorn`, UI with `npm run dev -- -p <frontendPort>`), then:

```bash
cd showcase/shell
npm install
npm run dev            # http://localhost:5173
```

The dev server serves `labs.json` straight from disk and tells the shell to load each lab from
`localhost:<frontendPort>`. Labs v1–v5 all use backend port 8000 and frontend port 3000, so run
one of them at a time.

## Deploying to a GoDaddy VPS

This needs a GoDaddy **VPS** (or dedicated server) with root SSH. GoDaddy shared/cPanel hosting
can't run Docker or long-running Python servers.

1. **DNS** (GoDaddy → My Products → your domain → DNS): add two `A` records pointing at the VPS IP,
   one for `@` and one for `*` (wildcard, so `v1.DOMAIN` … `v21.DOMAIN` resolve).
2. **Server**: install Docker with the Compose plugin and git; open ports 80 and 443.
3. **Code and secrets**:
   ```bash
   git clone https://github.com/utsav475908/genai-labs-chatgpt.git && cd genai-labs-chatgpt
   cp .env.example .env && nano .env    # OPENAI_API_KEY, JWT_SECRET, DOMAIN, ACME_EMAIL, SHOWCASE_ACCESS_KEY
   chmod 600 .env
   ```
4. **Deploy**:
   ```bash
   ./showcase/deploy/deploy.sh
   ```
   Open `https://DOMAIN/unlock?key=<SHOWCASE_ACCESS_KEY>` once; it sets a cookie for the
   showcase and every lab, then sends you to `https://DOMAIN`. Share that link with your audience.
   Without it every page and API returns 401, so nobody else can spend your OpenAI quota.
   Caddy gets a free HTTPS certificate per subdomain the first time each is visited.

`deploy.sh` regenerates `showcase/deploy/generated/` (Compose file, Caddyfile and combined
`requirements.txt`) from `labs.json`, builds one shared Python image for all backends plus one web
image holding the shell and every lab UI as static files, and starts everything. Re-run it after
pulling new code. The first build compiles 21 Next.js apps and takes a while.

**Sizing:** 21 backends use roughly 2–3 GB of RAM in total. On a small VPS, set `"enabled": false`
on labs you don't need and re-run `deploy.sh`.

**Data:** labs with `persist` in labs.json (v7–v11, v19 use SQLite) keep those files on the server
in `showcase/deploy/data/<id>/`, so conversations and accounts survive redeploys. The database
files committed in the repo are never copied into the image; deployment starts with empty ones.

## Files

```
showcase/
  config/labs.json          the one config file
  shell/                    React (Vite + TypeScript) showcase
    src/config/             types, validation (parseConfig.ts), runtime loading and polling
    src/components/         Sidebar, LabPage (iframe + pager), HealthBadge
  deploy/
    render.py               labs.json → generated/{docker-compose.yml, Caddyfile, requirements.txt}
    build-static.mjs        builds the shell and each lab UI as static files (used by web.Dockerfile)
    backend.Dockerfile      one Python image for every lab backend
    web.Dockerfile          Caddy + static shell + static lab UIs
    deploy.sh               render, build, start
```
