# Security Audit Report — SwimXpert

**Date:** 4 March 2025 (updated after security fixes)  
**Scope:** Angular frontend, .NET 9 API, PostgreSQL  
**Summary:** Full audit performed; major vulnerabilities addressed. This report reflects the current state after implementing JWT cookies, refresh tokens, email verification, lockout, password reset, audit logging, CSP, and 2FA.

---

## 1. AUTHENTICATION & SESSION SECURITY

### Implemented (current state)

| Item | Status |
|------|--------|
| **JWT in HttpOnly cookies** | Access token set as `access_token` cookie (HttpOnly, Secure, SameSite=Strict, 1h). No JWT in response body or localStorage. |
| **Refresh token rotation** | Refresh token in HttpOnly cookie `refresh_token` (7 days). POST `/api/auth/refresh` issues new access + refresh and revokes the old one. On logout, refresh token is revoked and both cookies cleared. |
| **CORS with credentials** | `AllowCredentials()` and `CORS_ALLOWED_ORIGINS` from env. Frontend sends `withCredentials: true` on all requests. |
| **Cookie-based JWT extraction** | In `Program.cs`, JWT bearer reads token from `Request.Cookies["access_token"]` when `Authorization` header is absent. |
| **Auth state from API** | Guards and auth use GET `/api/auth/me` to determine auth state (no token in localStorage). |
| **Logout** | POST `/api/auth/logout` clears cookies and revokes refresh token. |
| **Brute-force protection** | `RateLimitMiddleware`: 10 req/min per IP for login/register. Per-account lockout: 5 failed attempts → 15 min lock (423 with `secondsRemaining`). |
| **Password rules** | Register: min 8, max 128 chars; server-side validation; BCrypt work factor **12**. |
| **Email verification** | On register: verification token (24h), email with link to `/verify-email?token=`. GET `/api/auth/verify-email`, POST `/api/auth/resend-verification`. Login returns 403 with `email_not_verified` if not verified. |
| **Per-account lockout** | `FailedLoginAttempts`, `LockoutUntil` on User. On 5 failures: 15 min lock, counter reset, event logged. On success: counter and lock cleared. Frontend handles 423 with lockout message. |
| **Password reset** | POST `/api/auth/forgot-password` (always 200), POST `/api/auth/reset-password` (token + new password, BCrypt 12, single-use token, all refresh tokens for user revoked). Frontend: `/forgot-password`, `/reset-password`. |
| **Two-factor authentication (2FA)** | TOTP (Otp.NET). Login returns 202 with `2fa_required` when 2FA enabled; POST `/api/auth/2fa/verify` with code issues tokens. Endpoints: setup, enable, disable. Admin UI: `/admin/security` with QR code and enable/disable. |
| **Failed login logging** | Failed attempts and lockout events logged with IP and timestamp (no password/email in logs). |

### Not changed (by design)

| Item | Notes |
|------|------|
| **CSRF** | API uses cookies for auth; same-site requests only (SameSite=Strict). For cross-site forms, consider anti-forgery tokens if you add cookie-based non-JWT endpoints. |

---

## 2. AUTHORIZATION & ADMIN

### Verified / Implemented

| Item | Status |
|------|--------|
| **Admin endpoints** | Admin APIs use `[Authorize(Roles = "Admin")]` or role guard. |
| **IDOR** | Controllers enforce ownership (userId from token, swimmer/session checks). |
| **Role validation** | Admin user updates restrict role to allowed values. |
| **Angular guards** | `authGuard`, `adminGuard`, `roleGuard` protect routes; backend enforces. |
| **Admin audit log** | `AuditLog` entity and table; `IAuditLogService`/`AuditLogService`; logged: user updated/disabled, session created/updated/deleted. GET `/api/admin/audit-logs` with pagination and filters (action, date range). Frontend: `/admin/audit`. |

---

## 3. API & BACKEND (.NET)

### Implemented

| Item | Status |
|------|--------|
| **Global exception handling** | `GlobalExceptionMiddleware`: unhandled exceptions logged server-side, generic message to client; stack traces only in Development. |
| **Security headers** | `SecurityHeadersMiddleware`: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy; in non-Dev: HSTS, CSP. |
| **CSP** | Strict policy in non-Dev: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';` (no `unsafe-eval`). |
| **Rate limiting** | Custom `RateLimitMiddleware` for auth and lead capture. |
| **Lead capture input** | Name/Email/Phone/Source trimmed and length-capped. |
| **File upload** | Path traversal check (resolved path under `uploadsDir`). |
| **Secrets** | Connection string and JWT from env / config; no secrets in appsettings committed. |
| **JWT config** | AuthController uses `JWT_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE` from env with config fallback so tokens generate correctly when only env vars are set. |

### Recommendations

- **connect-src:** If the API is on a different origin than the frontend (e.g. `https://api.yourdomain.com`), add that origin to CSP `connect-src` in `SecurityHeadersMiddleware` (e.g. from config or env) so the browser allows API calls.

---

## 4. DATABASE (PostgreSQL)

### Verified

- Queries use EF Core (parameterized); no raw SQL with user input.
- Connection from `DATABASE_URL` or `ConnectionStrings__DefaultConnection`.
- Passwords and tokens stored hashed (BCrypt, token hashes); schema includes RefreshTokens, AuditLogs, User fields (email verification, lockout, password reset, 2FA).

### Schema (DDL in Program.cs)

- Users: EmailVerified, EmailVerificationTokenHash, EmailVerificationTokenExpiry, FailedLoginAttempts, LockoutUntil, PasswordResetTokenHash, PasswordResetTokenExpiry, TwoFactorEnabled, TwoFactorSecret.
- RefreshTokens table; AuditLogs table.

### Recommendations

- Prefer EF Core migrations for new changes; keep DDL in sync.
- Least-privilege DB user; do not expose PostgreSQL to the internet in production.

---

## 5. ANGULAR FRONTEND

### Implemented

| Item | Status |
|------|--------|
| **No JWT in localStorage** | Token not stored; auth state from `/api/auth/me` and user object in localStorage for UX only. |
| **withCredentials** | All HTTP requests send credentials (interceptor). |
| **No Authorization header** | Cookie sent automatically; interceptor does not set Bearer header. |
| **401 handling** | Interceptor calls `/api/auth/refresh` and retries; on refresh failure redirects to login. |
| **423 lockout** | Interceptor redirects to login with “Account locked. Try again in X minutes.” |
| **403 / email not verified** | Login shows message and “Resend verification email”. |
| **SafeUrlPipe** | Certificate images restricted to `assets/` URLs. |
| **Routes** | Protected and admin routes use guards; new routes: `/verify-email`, `/forgot-password`, `/reset-password`, `/admin/audit`, `/admin/security`. |

---

## 6. DOCKER & INFRASTRUCTURE

### Verified

- docker-compose uses env vars for Postgres; .gitignore covers `.env`, `appsettings.Production.json`, secrets.

### Recommendations

- Do not expose Postgres in production; use managed DB and `DATABASE_URL`.
- Use fixed image tags; HTTPS/TLS at reverse proxy or host.

---

## 7. SECRETS & CONFIGURATION

### Production environment variables

Set these on your host (e.g. Railway, or non-committed `.env`):

```bash
# Required
DATABASE_URL=Host=...;Port=5432;Database=...;Username=...;Password=...
JWT_KEY=your-min-32-character-secret-key

# CORS (required if frontend on different origin)
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com

# Optional
JWT_ISSUER=SwimXpert.Api
JWT_AUDIENCE=SwimXpert.Client
JWT_EXPIRY_MINUTES=60

# Email (for verification and password reset)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@yourdomain.com

# Frontend base URL for verification/reset links (if used by email service)
FRONTEND_URL=https://your-frontend-domain.com

# First admin (only when no admin exists)
INITIAL_ADMIN_EMAIL=admin@yourdomain.com
INITIAL_ADMIN_PASSWORD=strong-password-here
```

Do not set `INITIAL_ADMIN_*` after the first admin is created.

---

## 8. LOGGING & MONITORING

### Implemented

- Failed login and lockout events logged with IP and timestamp (no password/email).
- Global exception handler logs server-side; client gets generic message in production.
- Admin audit log records user and session actions.

### Recommendations

- Add structured logging (e.g. Serilog) for security events.
- Ensure logs never contain passwords, tokens, or full PII.

---

## 9. DEPENDENCY VULNERABILITIES

- **.NET:** Run `dotnet list package --vulnerable --include-transitive` and address any findings.
- **npm:** Angular 17 retained for compatibility; `npm audit` may still report issues. Plan upgrade (Node 20.19+ and Angular 21) when feasible. Run `npm audit` periodically.
- **Docker:** Use fixed image tags and update base images.

---

## 10. CHECKLIST — WHAT’S IN PLACE VS OPTIONAL

### In place

1. **Auth:** HttpOnly cookies (access + refresh), refresh rotation, `/api/auth/me`, logout clears cookies and revokes refresh.
2. **Security:** Rate limit, per-account lockout, BCrypt 12, email verification, password reset, 2FA (TOTP) for admins.
3. **API:** Global exception handler, security headers, strict CSP (no unsafe-eval), CORS with credentials, JWT from env/config.
4. **Admin:** Audit log service and endpoint; admin 2FA setup at `/admin/security`.
5. **Frontend:** No JWT in storage, withCredentials, 401→refresh→retry, 423/403 handling, new auth and admin routes.

### Optional / hosting-level

- **CSP connect-src:** If API and frontend are on different origins, add API origin to CSP (e.g. from env).
- **HTTPS:** Enforce at reverse proxy or host.
- **NuGet restore:** If `dotnet build` fails with NU1301, fix .NET/network environment (e.g. restore from a machine with NuGet access), then run `dotnet build` and `npm run build` to confirm zero compile errors.

---

## New frontend routes (for reference)

| Route | Purpose |
|-------|---------|
| `/verify-email` | Email verification (token in query). |
| `/forgot-password` | Request password reset. |
| `/reset-password` | Set new password (token in query). |
| `/admin/audit` | Admin audit log (table, filters, pagination). |
| `/admin/security` | Admin 2FA setup (QR, enable/disable). |

---

*Run `dotnet build` and `npm run build` locally to confirm everything compiles. If NuGet restore fails (NU1301), resolve .NET/network and retry.*
