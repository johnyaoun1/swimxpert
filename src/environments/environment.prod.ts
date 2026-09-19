// Production: API on Railway via custom domain (frontend on Cloudflare).
// Cookies: AUTH_COOKIE_DOMAIN=.swimxpert.com; CORS must list the FE origin with credentials.
export const environment = {
  production: true,
  apiUrl: 'https://api.swimxpert.com/api',
  /** See comment in environment.ts (swimming-only = separate Google calendar + its embed URL). */
  googleCalendarEmbedUrl:
    'https://calendar.google.com/calendar/embed?src=2e299c45bc19750b58ab77c6bf6a4b0559f2e7011bef5f6551cb449e70e85843%40group.calendar.google.com&ctz=Asia%2FBeirut'
};
