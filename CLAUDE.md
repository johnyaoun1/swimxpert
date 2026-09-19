# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (Angular)
```bash
npm start            # dev server on http://localhost:4200
npm run build        # production build → dist/swimxpert/
npm test             # run unit tests (Karma)
npm run build:ssr    # SSR build (Angular Universal)
```

### Backend (ASP.NET Core)
```bash
cd SwimXpert.Api
dotnet run           # dev server on http://localhost:5002 (see launchSettings.json)
dotnet build         # compile only
dotnet watch run     # hot reload
```

### Database (Docker)
```bash
docker compose up -d postgres   # local Postgres on port 5433
```

### EF Core migrations
```bash
cd SwimXpert.Api
dotnet ef migrations add <Name>
dotnet ef database update
```
Note: Most schema evolution is done via raw SQL `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in `Program.cs` at startup, not via EF migrations. Only use EF migrations for net-new tables tracked by the DbContext.

## Architecture

### Stack
| Layer | Tech |
|-------|------|
| Frontend | Angular 17 standalone components, Tailwind CSS, RxJS |
| Backend | ASP.NET Core 9 Web API, EF Core 9, PostgreSQL (Npgsql) |
| Auth | JWT access tokens + server-side refresh tokens, both in HttpOnly cookies |
| AI chat | Removed — Level Finder is rules-based (no Gemini) |
| Uploads | Cloudinary (prod) or local filesystem (dev, when `CLOUDINARY_*` env vars absent) |
| Calendar | Google Calendar OAuth2 sync (`GoogleCalendarSyncService`, `GoogleCalendarMutationsService`) |

### Authentication flow
- Tokens are stored in HttpOnly cookies (`access_token`, `refresh_token`) — not localStorage.
- The Angular `jwtInterceptor` clones every request with `withCredentials: true`. On a 401, it calls `POST /api/auth/refresh` once and retries; on a second failure it redirects to `/login`.
- `AuthService` holds the logged-in user in an Angular `signal<User | null>`. On init it calls `GET /api/auth/me` and syncs children + quiz results.

### Roles & route guards
| Role | API value | Frontend value | Guard |
|------|-----------|----------------|-------|
| Parent/client | `Parent` | `user` | `authGuard` + `clientOnlyGuard` |
| Coach | `Coach` | `coach` | `coachGuard` |
| Admin | `Admin` | `admin` | `adminGuard` |

- `clientOnlyGuard` — redirects admins and coaches away from `/dashboard`.
- `blockCoachGuard` — prevents coaches from accessing client booking flows.
- `approvedClientGuard` — gates `/quizzes` and `/leaderboard` behind `user.isApproved`.
- Self-registered users start with `IsApproved = false`; admin must approve them before they can access gated features.

### Frontend conventions
- All route components are lazy-loaded standalone. Add new routes in `src/app/app.routes.ts` and wire navigation in `src/app/shared/header/`.
- `ApiService` is the single HTTP facade — all backend calls go through it. Never call `HttpClient` directly from components or other services.
- Shared SCSS utilities live in `src/app/styles/`; global styles in `src/styles.css`.
- Use `date-fns` / `date-fns-tz` for date formatting. Beirut timezone helpers are in `src/app/utils/beirut-week.ts`.

### Backend conventions
- Controllers are thin: validate input, call services or EF directly, return results.
- `AuditLogService` must be called for any admin mutating action.
- `IStorageService` abstracts Cloudinary vs local — inject it, never call Cloudinary SDK directly.
- `IEmailService` abstracts SMTP — inject it for all email sends.
- All admin endpoints must be decorated `[Authorize(Roles = "Admin")]`.
- Security middleware stack (in order): `GlobalExceptionMiddleware` → `SecurityHeadersMiddleware` → `RateLimitMiddleware`.

### Database schema management
The `Program.cs` startup block runs `ALTER TABLE … ADD COLUMN IF NOT EXISTS` idempotent DDL. This is intentional — the app manages its own schema evolution without relying on EF migrations for additive changes. When adding a new column to an existing table, add it here. EF `DbSet<>` registrations still need to match.

### Environment variables
See `.env.example` for the full list. Required for local dev:
```
DATABASE_URL       # Railway postgres:// URI or Npgsql Host=… string (URI auto-converted)
JWT_KEY            # ≥32 char secret (dev default works but prod blocks the well-known dev key)
```
Optional (features degrade gracefully when absent):
- `CLOUDINARY_*` — falls back to local file storage
- `GOOGLE_CALENDAR_CLIENT_ID/SECRET/CALENDAR_ID` — Google Calendar sync disabled
- `SMTP_*` — email sends silently no-op

### Production deployment
See `DEPLOYMENT.md`. Targets Railway (API) + static hosting (frontend). Frontend `environment.prod.ts` must point `apiUrl` to the deployed API before building.
