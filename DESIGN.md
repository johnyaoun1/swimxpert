# SwimXpert — Public Page Design System

Rules for the **public** pages (home, about, locations, swim-lessons, level-finder,
contact, faq, gallery, certificates). Signed-in pages — dashboard, admin, coach, auth —
are deliberately **not** covered and keep their existing styling.

Reference: the restraint of equinox.com. Scale and spacing carry the page; colour and
decoration stay out of the way.

---

## Typeface

**Archivo only.** One family, self-hosted at `src/assets/fonts/archivo-var.woff2`
(variable, 100–900). The CSP allows `font-src 'self'`, so no font CDN — ever.

There is deliberately **no display face**. An earlier draft used Anton; it read as a
sports flyer rather than a premium club. Size and spacing create hierarchy instead.

```
font-family: 'Archivo', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
```

### Headline rules

- Weight **500**. Never 700+ for large headings — heavy weight at large size looks cheap.
- `letter-spacing: -0.025em`, `line-height: 1.02`
- **Uppercase only** for the hero and the closing CTA. Every other heading is sentence case.

| Role | Size |
|------|------|
| Hero | `clamp(3rem, 11vw, 8.5rem)` |
| Closing CTA | `clamp(2.5rem, 9vw, 6rem)` |
| Band heading | `clamp(2rem, 6vw, 4rem)` |
| Card heading | `clamp(1.9rem, 4.6vw, 3.25rem)` |
| Lede | `clamp(1rem, 2.6vw, 1.25rem)`, line-height 1.5, max 34ch |
| Body | `1rem`, line-height 1.65, max 46ch |
| Eyebrow | `0.6875rem`, weight 600, `letter-spacing: 0.24em`, uppercase |

Keep copy short: a heading plus **two lines at most** per card.

---

## Colour

The existing brand palette in `tailwind.config.js`. White and navy do the work; blue
and cyan appear sparingly.

| Token | Hex | Use |
|-------|-----|-----|
| `navy-950` | `#030811` | Page canvas |
| `navy-900` | `#060e24` | Alternate band, text on white cards |
| `primary-700` | `#0d5a96` | Filled blue button (white text) |
| `primary-500` | `#1d9bf0` | Decorative only |
| `accent-500` | `#00c4ff` | Small accent text, links on dark, focus rings |
| `slate-300` | `#cbd5e1` | Body text on dark |
| `slate-600` | `#475569` | Body text on white cards |

### Contrast — all verified, minimum 4.5:1

| Combination | Ratio |
|-------------|-------|
| White on `navy-950` | 20.1:1 |
| `slate-300` on `navy-950` | 13.5:1 |
| `accent-500` on `navy-950` | 9.9:1 |
| `navy-900` on white | 19.2:1 |
| `slate-600` on white | 7.4:1 |
| White on `primary-700` | 7.2:1 |

**Never put white text on `primary-500` (#1d9bf0) — it is 3.00:1 and fails.** If you
need the bright blue behind text, use black on it (7.0:1), or switch to `primary-700`.

---

## Buttons and links

**Square corners. No pills.** `border-radius: 0` — the only exception is the circular
floating WhatsApp button, where the round shape is a recognised affordance.

| Type | Style |
|------|-------|
| Primary | Solid white, `navy-900` text, uppercase, `letter-spacing: 0.08em`, min-height `3.25rem` |
| Large primary | Same, min-height `3.75rem` |
| Secondary | **Underlined text link**, not an outlined button |

Focus is always visible: `outline: 3px solid accent-500; outline-offset: 3px`.

### How often to ask

WhatsApp is the goal, but repetition cheapens it:

- **Hero** — one WhatsApp button
- **Closing** — one WhatsApp button
- **Floating button** — mobile only (hidden at `min-width: 900px`), and only
  **once the hero has scrolled away**. Over the hero it is `opacity: 0`,
  `pointer-events: none` and `aria-hidden` — the hero already has its own button,
  so showing both stacks the same ask twice.
- **Header** — one WhatsApp button, far right
- **Every other section** — at most one quiet underlined link, never a WhatsApp button

WhatsApp URL, always with the prefilled message:

```
https://wa.me/96176144927?text=Hi%2C%20I%27d%20like%20to%20book%20a%20swimming%20lesson%20for%20my%20child
```

---

## Header and footer

Both are shared with signed-in pages, so each renders a public variant keyed off
`isPublicUrl()` in `src/app/shared/public-routes.ts`. Dashboard, admin, coach and
the auth screens keep their original chrome — change that helper, not the markup,
to bring a route into the system.

**Header (public):** a `SwimXpert` wordmark in Archivo — 700, `letter-spacing:
0.2em`, uppercase — not the round logo, which stays as the favicon and on
signed-in pages.

Six links only: **Lessons, Level Finder, Locations, About, Gallery, FAQ**, then
**Log in** (or Dashboard/Admin plus Log out when signed in), then one white
WhatsApp button. Certificates and Contact live in the footer. Sign Up is not in
the nav at all — the login page carries "New here? Create an account".

Resist adding links here. A long nav is the fastest way to make the page feel
ordinary again.

**Footer (public):** four columns — wordmark and one line, Lessons, More, Get in
touch. No Login or Sign Up (the header has them), and none of the blurred blue
orbs from the old design. Headings use the eyebrow style in `accent-500`; links
are `#e2e8f0` at 14.6:1, body `#94a3b8` at 7.8:1.

## The card pattern

The repeating unit: **full-bleed media, one solid white card.**

- Card is **solid white**, `border-radius: 0`, **no shadow**, no blur, no transparency
- Contains: eyebrow, heading, ≤2 lines of body, one underlined link

**Desktop (≥900px):** the card overlays the media. `max-width: 32rem`, padding
`clamp(2.25rem, 4.5vw, 4.25rem)`, alternating left and right (`.feature--right`),
section `min-height: min(92vh, 56rem)`.

**Phone:** the card must *not* sit on top of the photo — that hides the image.
The media gets its own height (`56vh`, capped at `30rem`), then the card follows
in flow with `margin-top: -5rem` so it overlaps only the photo's bottom edge.

Repeat the same pattern rather than inventing per-section layouts. The rhythm is the point.

A section with no suitable photograph becomes a **typographic band** on `navy-900`
instead — never stretch an ill-fitting image to fill one.

---

## Photography

Source photos are **1024px wide**, bright and busy. Until real 2000px+ photography
exists, two rules keep them coherent:

**1. One grade, applied to every image:**

```css
filter: brightness(0.72) saturate(0.74) contrast(1.06);
```

Moody, not murky — the subject must stay clearly readable. Sources that are
already dark (underwater, aqua gym) get `.media__img--lift` instead, which backs
the grade off to `brightness(0.94) saturate(0.8)`; the standard grade buries them.

Scrim on top: a light vertical wash on phones (atmosphere only — it holds up no
text there), and a directional gradient on desktop that darkens toward whichever
edge the card sits on.

**2. Cap the upscale.** Media containers are capped at `max-width: 120rem` and centred;
past that the navy canvas shows at the edges rather than the image going soft.

Also required: WebP, explicit `width`/`height` to prevent layout shift, `loading="lazy"`
below the fold (**never** on the hero), `decoding="async"`.

### Outstanding placeholders

| Section | Current | Needs |
|---------|---------|-------|
| Hero video | none — poster only | `assets/video/hero.webm` + `hero.mp4`, under ~3MB |
| Hero poster | `swimmer-butterfly.webp` | Real footage still |
| All four features | existing `swimmer-*.webp` | 2000px+ originals |
| Location band | no photo | A real Cap Sur Ville photograph |

---

## Spacing

Generous and consistent. Sections breathe more than feels comfortable.

| Context | Value |
|---------|-------|
| Section padding (mobile) | `clamp(5rem, 15vw, 10rem)` vertical, `1.5rem` horizontal |
| Section padding (≥900px) | `7rem` vertical, `clamp(2rem, 6vw, 6rem)` horizontal |
| Feature min-height | `34rem` mobile, `44rem` desktop |
| Content max-width | `82rem` hero, `60rem` band, `48rem` closing |

---

## Motion

Restrained: a fade and a short rise, nothing else.

- `opacity 0 → 1`, `translateY(1.25rem) → 0`, `0.8s ease-out`
- Driven by `IntersectionObserver` in the component, added via `[data-reveal]`
- Guard with `isPlatformBrowser` — it must not run during prerendering
- Under `prefers-reduced-motion: reduce`: everything visible immediately, transitions
  off, and the hero video paused

---

## Non-negotiable constraints

- **No inline scripts** — CSP is `script-src 'self'` with no `unsafe-inline` or nonce
- **No external images, fonts or scripts** — everything under `src/assets`
- Self-hosted fonts only (`font-src 'self'`)
- Keep every route, SEO tag, canonical URL and the JSON-LD intact
- Prerendering must keep working — `npm run build` prerenders 9 routes
- The app shell already provides `<main id="main-content">`; never nest another
- Body text contrast **≥ 4.5:1**, everywhere, verified not guessed
