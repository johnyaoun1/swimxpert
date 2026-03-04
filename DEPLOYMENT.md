# SwimXpert Production Deployment Guide

## Pre-Deployment Checklist

### Backend (SwimXpert.Api)

- [ ] **Environment variables** set in Railway (or host):
  - `DATABASE_URL` – Supabase Postgres connection string (e.g. `Host=...;Port=5432;Database=...;Username=...;Password=...;SSL Mode=Require`)
  - `JWT_KEY` – Strong secret (32+ chars), e.g. `openssl rand -base64 32`
  - `JWT_ISSUER` – e.g. `SwimXpert.Api`
  - `JWT_AUDIENCE` – e.g. `SwimXpert.Client`
  - `CORS_ALLOWED_ORIGINS` – Comma-separated frontend URLs (e.g. `https://swimxpert.com,https://app.swimxpert.com`)
  - `ASPNETCORE_ENVIRONMENT` – `Production`

- [ ] **Secrets** – Never commit JWT_KEY or DB password to git

### Frontend

- [ ] **API URL** – Edit `src/environments/environment.prod.ts`:
  - Use `/api` only if frontend and API share the same origin (reverse proxy)
  - Otherwise use full API URL, e.g. `https://your-api.railway.app/api`

- [ ] **Build** – `npm run build` (production build uses `environment.prod.ts`)

### Railway Setup

1. Create a project with two services: **API** (backend) and **Web** (frontend static).
2. **API service**:
   - Root: `SwimXpert.Api` (or project root if monorepo)
   - Build: `dotnet publish -c Release -o ./publish`
   - Start: `dotnet SwimXpert.Api.dll` (from publish folder)
   - Add env vars above.
3. **Web service**:
   - Root: project root
   - Build: `npm ci && npm run build`
   - Output: `dist/swimxpert`
   - Serve static files (Nginx or Railway static hosting).

### Supabase (PostgreSQL)

1. Create project and copy connection string.
2. Use **Connection pooling** string if available (port 6543).
3. Ensure `DATABASE_URL` in Railway matches Supabase credentials.

---

## Smoke Tests (Post-Deploy)

Run these after deployment to confirm core flows work.

### Public

1. **Home** – Load `/` → no errors.
2. **Contact form** – Submit name, email, message → success message; verify lead in admin.
3. **Lead capture modal** – Trigger modal, submit → lead appears in admin.

### Auth

4. **Register** – Create account → redirected to dashboard.
5. **Login** – Login with credentials → dashboard loads.
6. **Logout** → redirected to login/home.

### Parent Dashboard

7. **Add child** – Add child with name, age, level → appears in list.
8. **Edit child** – Edit profile, change profile picture → saves.
9. **Profile picture upload** – Upload image → preview updates.

### Admin

10. **Admin dashboard** – Login as admin → overview loads.
11. **Leads** – View leads, mark as contacted.
12. **Users** – View users, toggle roles if needed.

### API Health

13. **Health** – `GET https://your-api.railway.app/api/health` → 200 OK.

---

## Security Summary

- Auth endpoints: login, register (public); validate-token, swimmer CRUD (authenticated).
- Admin-only: users, leads, revenue, swimmer skills toggle.
- Payments and registrations enforce ownership (user/swimmer) or admin/coach.
- HTTPS enforced in production.
- JWT and DB config from environment variables.

---

## Known Limitations

- **File uploads** – Stored in `wwwroot/uploads` (ephemeral on Railway). Consider Supabase Storage or S3 for production.
