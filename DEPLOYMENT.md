# SwimXpert Production Deployment Guide

## Recommended topology: same-origin reverse proxy

This codebase is built for **one public origin** (e.g. `https://swimxpert.com`):

| Signal | Current setting |
|--------|-----------------|
| `environment.prod.ts` | `apiUrl: '/api'` |
| Auth cookies | `SameSite=Strict`, `Secure` in prod, `HttpOnly`, `Path=/` |
| CSP (`SecurityHeadersMiddleware`) | `connect-src 'self'` — blocks a separate API host unless you change CSP |
| Angular | `withCredentials: true` on all API calls |

**Do not** put the SPA on `app.swimxpert.com` and the API on `api.swimxpert.com` unless you also switch cookies to `SameSite=None; Secure`, widen CORS, change `apiUrl` to the absolute API URL, and update CSP `connect-src`. That is higher risk for this project.

```
Browser  →  https://swimxpert.com/          →  static Angular (Web / nginx)
         →  https://swimxpert.com/api/*     →  proxied to ASP.NET (private)
```

Cookies are set for `swimxpert.com` and sent on same-origin `/api` requests. `SameSite=Strict` stays valid.

---

## Pre-Deployment Checklist

### Backend (SwimXpert.Api) — Railway service `api`

- [ ] **Environment variables**:
  - `DATABASE_URL` – Postgres connection string (`SSL Mode=Require` if needed)
  - `JWT_KEY` – Strong secret (32+ chars), e.g. `openssl rand -base64 32`
  - `JWT_ISSUER` – e.g. `SwimXpert.Api`
  - `JWT_AUDIENCE` – e.g. `SwimXpert.Client`
  - `ASPNETCORE_ENVIRONMENT` – `Production`
  - `ASPNETCORE_URLS` – `http://0.0.0.0:$PORT` (Railway sets `PORT`)
  - `CORS_ALLOWED_ORIGINS` – Public site origin(s), no trailing slash  
    e.g. `https://swimxpert.com,https://www.swimxpert.com`
  - `ALLOWED_HOSTS` – e.g. `swimxpert.com,www.swimxpert.com` (and Railway hostname if you hit the API URL directly)
  - `FRONTEND_URL` – e.g. `https://swimxpert.com` (email verify / reset links)
  - `AUTH_COOKIE_SAMESITE` – `Strict` (default; omit unless you know you need otherwise)
  - `AUTH_COOKIE_SECURE` – omit (defaults to secure off-localhost). Do not set `false` in production.
  - Google Calendar (if used):
    - `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET` / `GOOGLE_CALENDAR_CALENDAR_ID`
    - `GoogleCalendar__PublicApiBaseUrl` = `https://swimxpert.com` (public URL that receives `/api/google-oauth/callback`)
    - `GoogleCalendar__FrontendRedirectBaseUrl` = `https://swimxpert.com`
  - Optional: `CLOUDINARY_*`, `SMTP_*`, `GEMINI_API_KEY`, `INITIAL_ADMIN_*`

- [ ] **Private networking** – Web service reaches API via Railway private DNS (e.g. `http://api.railway.internal:8080`), not the public `*.railway.app` URL, so only the site origin is public.

- [ ] **Secrets** – Never commit `JWT_KEY` or DB passwords.

### Frontend — keep `apiUrl: '/api'`

`src/environments/environment.prod.ts` should stay:

```ts
apiUrl: '/api',
```

Build: `npm ci && npm run build` → `dist/swimxpert/browser` (or `dist/swimxpert` depending on Angular version output).

### Railway setup (two services + proxy)

1. **API service** (`api`)
   - Root / watch path: `SwimXpert.Api`
   - Build: `dotnet publish -c Release -o ./publish`
   - Start: `cd publish && dotnet SwimXpert.Api.dll`
   - Env vars from the checklist above
   - Custom domain: **optional** (prefer private-only + proxy)

2. **Web service** (`web`)
   - Serves static Angular + **reverse-proxies** `/api` → private API
   - Custom domain: `swimxpert.com` (and `www` if needed)
   - Example nginx config: [`deploy/nginx.conf.example`](deploy/nginx.conf.example)
   - Example Caddy: [`deploy/Caddyfile.example`](deploy/Caddyfile.example)

3. Attach the custom domain only to **Web**. TLS terminates at Railway/edge; proxy to API over HTTP on the private network is fine.

### Supabase (PostgreSQL)

1. Create project and copy connection string (pooling port 6543 if available).
2. Set `DATABASE_URL` on the API service.

---

## Cookie / CORS summary (same-origin)

| Setting | Value |
|---------|--------|
| `SameSite` | `Strict` |
| `Secure` | `true` in production |
| `HttpOnly` | `true` |
| `Path` | `/` |
| `Domain` | unset (host-only on `swimxpert.com`) |
| CORS | `CORS_ALLOWED_ORIGINS` = public frontend origin(s) + `AllowCredentials()` |

Cross-origin fallback (not recommended): set `AUTH_COOKIE_SAMESITE=None`, `apiUrl` to `https://api…/api`, expand CSP `connect-src`, and list the SPA origin in `CORS_ALLOWED_ORIGINS`.

---

## Local test of same-origin cookies (before deploy)

Dev today (`localhost:4200` → `localhost:5002`) already sends Strict cookies because Chromium treats different localhost ports as **same-site**. That does **not** prove production subdomain behavior.

To mimic production same-origin proxy locally:

### Option A — Caddy (recommended)

1. Install Caddy.
2. From repo root, with API on `:5002` and `ng serve` on `:4200`:

```bash
caddy run --config deploy/Caddyfile.local.example
```

3. Open **http://localhost:8080** (not :4200).
4. Log in → DevTools → Application → Cookies for `localhost`:
   - `access_token` / `refresh_token`: HttpOnly, SameSite=Strict, Path=/
5. Network: `POST /api/auth/login` and later `GET /api/auth/me` should show cookies on the request (same host `:8080`).

### Option B — curl cookie jar

```bash
# Hit API as if behind the public host (after login flow)
curl -c /tmp/sx.jar -b /tmp/sx.jar -X POST http://localhost:5002/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"you@example.com","password":"yourpassword"}' -v
# Check Set-Cookie: SameSite=Strict; Path=/; HttpOnly
curl -b /tmp/sx.jar http://localhost:5002/api/auth/me -v
```

---

## Smoke Tests (Post-Deploy)

### Public

1. **Home** – Load `/` → no errors.
2. **Contact form** – Submit → success; lead in admin.
3. **Lead capture modal** – Submit → lead in admin.

### Auth (cookie-focused)

4. **Register / Login** on `https://yourdomain.com` (proxied origin).
5. DevTools → Cookies: `access_token` / `refresh_token` on **your domain**, SameSite=Strict, Secure, HttpOnly.
6. Refresh the page → still logged in (`GET /api/auth/me` 200 with cookies).
7. **Logout** → cookies cleared; `/api/auth/me` 401.

### Parent / Admin

8. Add/edit child, admin overview, leads, users as usual.

### API Health

9. Prefer `https://yourdomain.com/api/health` (through the proxy). Direct Railway API URL is optional.

---

## Security Summary

- JWT in HttpOnly cookies (not localStorage).
- Refresh rotation via `POST /api/auth/refresh`.
- CORS + credentials only for listed origins.
- HTTPS / HSTS in production; forwarded headers honor Railway’s `X-Forwarded-Proto`.

---

## Known Limitations

- **File uploads** – Local `wwwroot/uploads` is ephemeral on Railway; use Cloudinary (`CLOUDINARY_*`) in production.
