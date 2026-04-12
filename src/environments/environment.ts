export const environment = {
  production: false,
  apiUrl: 'http://localhost:5002/api',
  /**
   * Contact page: embed URL only (the `src="..."` from Google’s iframe), or '' to hide.
   *
   * “Only swimming” on the site: Google can’t embed one label from a mixed calendar.
   * Create a calendar that contains only swimming (Calendar web → + Other calendars →
   * Create new calendar), add/move swimming events there, then embed that calendar only.
   *
   * Get the URL: calendar.google.com → gear ⚙️ Settings → left column “Settings for my
   * calendars” → click that swimming-only calendar → scroll to “Integrate calendar” →
   * copy the embed code and paste only the `src="https://calendar.google.com/..."` value.
   * (Or: left sidebar under “My calendars”, hover the calendar name → ⋮ → Settings and
   * sharing → Integrate calendar.)
   */
  googleCalendarEmbedUrl:
    'https://calendar.google.com/calendar/embed?src=2e299c45bc19750b58ab77c6bf6a4b0559f2e7011bef5f6551cb449e70e85843%40group.calendar.google.com&ctz=Asia%2FBeirut'
};
