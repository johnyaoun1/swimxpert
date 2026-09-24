// Routes that get the redesigned public treatment (see DESIGN.md). Everything
// else — dashboard, admin, coach, auth — keeps the original styling.
export const PUBLIC_ROUTES = new Set([
  '/',
  '/about',
  '/locations',
  '/swim-lessons',
  '/level-finder',
  '/contact',
  '/faq',
  '/gallery',
  '/certificates'
]);

export function isPublicUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return PUBLIC_ROUTES.has(path);
}
