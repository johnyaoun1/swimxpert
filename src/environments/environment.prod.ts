// Replace with your production API URL, e.g. 'https://your-api.railway.app/api'
// Use '/api' only if frontend and API are served from same origin (reverse proxy)
export const environment = {
  production: true,
  apiUrl: '/api',
  /** See comment in environment.ts (swimming-only = separate Google calendar + its embed URL). */
  googleCalendarEmbedUrl:
    'https://calendar.google.com/calendar/embed?src=2e299c45bc19750b58ab77c6bf6a4b0559f2e7011bef5f6551cb449e70e85843%40group.calendar.google.com&ctz=Asia%2FBeirut'
};
