# SwimXpert Production Deployment Guide

## Topology (current): Cloudflare frontend + Railway API/Postgres

Frontend (apex) and API (`api.` subdomain) are **different origins under the same site**:

```
Browser  →  https://swimxpert.com/         →  Cloudflare Worker (prerendered Angular assets)
         →  https://api.swimxpert.com/api  →  Railway service "api" → Postgres
```

`www.swimxpert.com` and `app.swimxpert.com` both 301 to the apex via Cloudflare Redirect
Rules — see "Cloudflare dashboard settings" below. There is no redirect logic in this
repo.

| Piece | Setting |
|--------|---------|
| `environment.prod.ts` | Absolute `apiUrl` → Railway API (`…/api`) |
| Auth cookies | `HttpOnly`, `Secure`, `SameSite=Strict`, `Domain=.swimxpert.com` (`AUTH_COOKIE_DOMAIN`) |
| CORS | `CORS_ALLOWED_ORIGINS` = exact FE origins + `AllowCredentials()` (never `*`) |
| Angular | `withCredentials: true` on API calls |

**Important:** Browsers only accept `Domain=.swimxpert.com` cookies when the API response host is under `swimxpert.com` (e.g. `api.swimxpert.com`). Cookies set from `*.up.railway.app` with that Domain are rejected — which is why the Railway-generated URL is not usable for authenticated traffic.

---

## Pre-Deployment Checklist

### Backend (SwimXpert.Api) — Railway service `api`

- [x] Hobby plan / billing active
- [x] Postgres plugin running
- [x] API deployed (`SwimXpert.Api/Dockerfile` via `RAILWAY_DOCKERFILE_PATH`)
- [x] Public domain generated
- [x] Custom domain `api.swimxpert.com` DNS (Cloudflare → Railway)
- [x] Env (see also `deploy/railway.env.example`):
  - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
  - `JWT_KEY` (unique, not the well-known DevKey)
  - `AUTH_COOKIE_DOMAIN=.swimxpert.com`
  - `AUTH_COOKIE_SECURE=true`
  - `CORS_ALLOWED_ORIGINS=https://swimxpert.com,https://www.swimxpert.com`
  - `FRONTEND_URL=https://swimxpert.com`
  - `ALLOWED_HOSTS=api.swimxpert.com;api-production-3b21e.up.railway.app`
  - Optional: `CLOUDINARY_*`, `SMTP_*`, `INITIAL_ADMIN_*`

### Railway dashboard settings — service `api`

Build/deploy config lives in the Railway dashboard, not in the repo. Config as Code
(`railway.toml`) was removed: Railway stops reading it on 2026-12-01, and its
Infrastructure as Code replacement (`.railway/railway.ts`) is a declarative model whose
applies can delete undeclared resources — not worth the risk against a Postgres with no
automatic backups, for three settings that are already defaults or set elsewhere.

Re-create by hand if the service is ever rebuilt (service `api` → **Settings**):

| Setting | Value |
|---------|-------|
| Build → Builder | Dockerfile (resolved from `RAILWAY_DOCKERFILE_PATH`) |
| Build → Dockerfile Path | `SwimXpert.Api/Dockerfile` |
| Build → Root Directory | unset (repo root — the Dockerfile path is relative to it) |
| Deploy → Restart Policy | On Failure, max retries 10 |

Also dashboard-managed and never covered by `railway.toml`: env vars (see
`deploy/railway.env.example`), the `api-volume` mount at `/app/wwwroot/uploads`, the
`api.swimxpert.com` custom domain, and the EU West (Amsterdam) region pin.

### Frontend — Cloudflare

- [x] Cloudflare Worker created (`wrangler.toml`, static assets from `dist/swimxpert/browser`)
- [x] `environment.prod.ts` → `apiUrl: 'https://api.swimxpert.com/api'`
- [x] DNS: `swimxpert.com` apex → Cloudflare (`www` + `app.swimxpert.com` 301 → apex)
- [x] Production build deployed (auto-deploys on push to `main`)

### Cloudflare dashboard settings — Worker `swimxpert`

Like Railway, the frontend's routing config lives in the Cloudflare dashboard, not in
this repo. `wrangler.toml` only declares the Worker name and the static-asset directory.

**Custom domains** (Workers & Pages → `swimxpert` → Custom Domains and Routes), all
Production:

| Domain | Purpose |
|--------|---------|
| `swimxpert.com` | Serves the site |
| `www.swimxpert.com` | Exists only so the hostname resolves; redirected before the Worker runs |
| `app.swimxpert.com` | Legacy domain, same — redirected before the Worker runs |

The Production `workers.dev` URL is **disabled** (Preview stays enabled), so the site is
reachable only through the domains above.

**Redirect Rules** (zone `swimxpert.com` → Rules → Redirect Rules), both wildcard, 301,
preserve query string:

| Rule | Request URL | Target |
|------|-------------|--------|
| Redirect from WWW to root | `https://www.swimxpert.com/*` | `https://swimxpert.com/${1}` |
| app to root | `https://app.swimxpert.com/*` | `https://swimxpert.com/${1}` |

Redirect Rules run **before** the Worker serves anything, so a redirected hostname never
reaches the asset handler. Both hostnames must still exist as Worker custom domains — a
hostname that does not resolve returns `DNS_PROBE_FINISHED_NXDOMAIN` and the rule never
gets a chance to fire.

---

## Cookie / CORS summary (split subdomains)

| Setting | Value |
|---------|--------|
| `SameSite` | `Strict` (same-site across `*.swimxpert.com`) |
| `Secure` | `true` |
| `HttpOnly` | `true` |
| `Path` | `/` |
| `Domain` | `.swimxpert.com` |
| CORS | Explicit origins + `AllowCredentials()` |

---

## Local same-origin proxy (optional / legacy)

Dev still uses `apiUrl: '/api'` + `proxy.conf.json` → `:5002`. See `deploy/Caddyfile.local.example` for a local reverse-proxy rehearsal. Production no longer relies on Express `/api` proxy on Railway.
