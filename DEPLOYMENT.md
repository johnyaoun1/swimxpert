# SwimXpert Production Deployment Guide

## Topology (current): Cloudflare frontend + Railway API/Postgres

Frontend and API are **different subdomains** of `swimxpert.com` (same *site*, different *origins*):

```
Browser  →  https://app.swimxpert.com/     →  Cloudflare (Angular SSR / Pages)
         →  https://api.swimxpert.com/api  →  Railway service "api" → Postgres
```

| Piece | Setting |
|--------|---------|
| `environment.prod.ts` | Absolute `apiUrl` → Railway API (`…/api`) |
| Auth cookies | `HttpOnly`, `Secure`, `SameSite=Strict`, `Domain=.swimxpert.com` (`AUTH_COOKIE_DOMAIN`) |
| CORS | `CORS_ALLOWED_ORIGINS` = exact FE origins + `AllowCredentials()` (never `*`) |
| Angular | `withCredentials: true` on API calls |

**Important:** Browsers only accept `Domain=.swimxpert.com` cookies when the API response host is under `swimxpert.com` (e.g. `api.swimxpert.com`). Cookies set from `*.up.railway.app` with that Domain are rejected.

Interim Railway public URL (until DNS): `https://api-production-3b21e.up.railway.app`

---

## Pre-Deployment Checklist

### Backend (SwimXpert.Api) — Railway service `api`

- [x] Hobby plan / billing active
- [x] Postgres plugin running
- [x] API deployed (`SwimXpert.Api/Dockerfile` via `RAILWAY_DOCKERFILE_PATH`)
- [x] Public domain generated
- [ ] Custom domain `api.swimxpert.com` DNS (Cloudflare → Railway)
- [x] Env (see also `deploy/railway.env.example`):
  - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
  - `JWT_KEY` (unique, not the well-known DevKey)
  - `AUTH_COOKIE_DOMAIN=.swimxpert.com`
  - `AUTH_COOKIE_SECURE=true`
  - `CORS_ALLOWED_ORIGINS=http://localhost:4200,https://app.swimxpert.com,https://swimxpert.com,https://www.swimxpert.com`
  - `FRONTEND_URL=https://app.swimxpert.com`
  - `ALLOWED_HOSTS=*` (tighten after custom domain is live)
  - Optional: `CLOUDINARY_*`, `SMTP_*`, `INITIAL_ADMIN_*`

### Frontend — Cloudflare

- [ ] Cloudflare Pages/Workers project created
- [x] `environment.prod.ts` points at live API URL (update again when `api.swimxpert.com` is live)
- [ ] DNS: `app.swimxpert.com` (and optionally apex) → Cloudflare
- [ ] Deploy production build (`npm run build`)

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
