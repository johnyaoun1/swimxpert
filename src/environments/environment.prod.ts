// Production: keep '/api' for same-origin reverse proxy (see DEPLOYMENT.md).
// Do not point this at a different subdomain unless you also switch cookies to
// SameSite=None, widen CORS, and update CSP connect-src.
export const environment = {
  production: true,
  apiUrl: '/api',
  /** See comment in environment.ts (swimming-only = separate Google calendar + its embed URL). */
  googleCalendarEmbedUrl:
    'https://calendar.google.com/calendar/embed?src=2e299c45bc19750b58ab77c6bf6a4b0559f2e7011bef5f6551cb449e70e85843%40group.calendar.google.com&ctz=Asia%2FBeirut'
};
