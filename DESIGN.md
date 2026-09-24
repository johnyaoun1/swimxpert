# SwimXpert — Public Page Design System

Rules for the **public** pages (home, about, locations, swim-lessons, level-finder,
contact, faq, gallery, certificates). Signed-in pages — dashboard, admin, coach — and
the auth screens are deliberately **not** covered and keep their existing styling.

Reference: the restraint of equinox.com. Scale and spacing carry the page; colour and
decoration stay out of the way.

---

## How this works

All values live as CSS custom properties in **`src/app/styles/public-tokens.css`**,
imported from `src/styles.css`.

**Public stylesheets must use tokens and nothing else** — no raw hex, no raw px, no
one-off durations. If you need a value that doesn't exist, add a token and document it
here. Do not inline a literal.

### Scoping

The tokens are not on `:root`. They apply only to:

```css
.sx-public, .site-header--public, .site-footer--public
```

- `.sx-public` is bound in `app.component.html` on `<main id="main-content">`
- The header and footer variants are bound in their own components
- All three key off `isPublicUrl()` in `src/app/shared/public-routes.ts`

So a signed-in page inherits **no** tokens at all — verified: `/login` resolves
`--sx-bg` to empty. To bring a new route into the system, add it to `PUBLIC_ROUTES`;
don't touch the markup.

**The one exception:** media query breakpoints cannot use custom properties — CSS
doesn't allow it. `900px` (phone → desktop) and `768px` (footer columns) are written
literally. Everything else is a token.

---

## Colour

Named by role, not by hue. Brand palette only.

| Token | Value | Use |
|-------|-------|-----|
| `--sx-bg` | `#030811` | Page canvas |
| `--sx-bg-alt` | `#060e24` | Alternate band |
| `--sx-surface` | `#ffffff` | Cards |
| `--sx-text-primary` | `#ffffff` | Headings and body on dark |
| `--sx-text-muted` | `#cbd5e1` | Secondary text on dark |
| `--sx-text-on-surface` | `#060e24` | Text on white cards |
| `--sx-text-muted-on-surface` | `#475569` | Secondary text on cards |
| `--sx-accent` | `#00c4ff` | Eyebrows on dark, link hover, focus rings |
| `--sx-button-bg` / `--sx-button-text` | `#ffffff` / `#060e24` | Primary button |
| `--sx-button-bg-hover` | `#cbd5e1` | Primary button hover |
| `--sx-button-blue` | `#0d5a96` | Filled blue (floating button) |
| `--sx-button-blue-hover` | `#1d9bf0` | Hover only, paired with dark text |
| `--sx-bg-rgb` / `--sx-accent-rgb` | `3 8 17` / `0 196 255` | Bare channels for alpha |

### Contrast — every pairing verified

| Combination | Ratio |
|-------------|-------|
| `--sx-text-primary` on `--sx-bg` | 20.1:1 |
| `--sx-text-muted` on `--sx-bg` | 13.5:1 |
| `--sx-accent` on `--sx-bg` | 9.9:1 |
| `--sx-text-on-surface` on `--sx-surface` | 19.2:1 |
| `--sx-text-muted-on-surface` on `--sx-surface` | 7.4:1 |
| White on `--sx-button-blue` | 7.2:1 |

**Never put white text on `#1d9bf0` — 3.00:1, fails.** Use `--sx-button-blue`
(7.2:1) or black on it (7.0:1). `--sx-button-blue-hover` exists only for a hover
state that also flips the text to dark.

---

## Typography

**Archivo only**, self-hosted at `src/assets/fonts/archivo-var.woff2` (variable,
100–900). The CSP allows `font-src 'self'`, so never a font CDN.

There is deliberately **no display face**. An earlier draft used Anton; it read as a
sports flyer. Size and spacing create hierarchy instead.

| Role | Size token | Weight | Leading | Tracking |
|------|-----------|--------|---------|----------|
| Hero | `--sx-hero-size` `clamp(2.625rem, 11vw, 8.5rem)` | 500 | 1.02 | −0.025em |
| h1 (closing) | `--sx-h1-size` `clamp(2.5rem, 9vw, 6rem)` | 500 | 1.02 | −0.025em |
| h2 (band) | `--sx-h2-size` `clamp(2rem, 6vw, 4rem)` | 500 | 1.05 | −0.02em |
| h3 (card) | `--sx-h3-size` `clamp(1.9rem, 4.6vw, 3.25rem)` | 500 | 1.05 | −0.02em |
| Lede | `--sx-lede-size` `clamp(1.0625rem, 2.6vw, 1.5rem)` | 400 | 1.45 | — |
| Body | `--sx-body-size` `1.0625rem` | 400 | 1.6 | — |
| Small | `--sx-small-size` `0.9375rem` | 400 | 1.5 | — |
| Eyebrow | `--sx-eyebrow-size` `0.6875rem` | 700 | — | 0.24em |
| Button | `--sx-button-size` `0.875rem` | 600 | — | 0.08em |
| Nav link | `--sx-nav-size` `0.8125rem` | 500 | — | 0.05em |
| Wordmark | `--sx-wordmark-size` `1.0625rem` | 700 | — | 0.2em |
| Chrome CTA | `--sx-cta-size` `0.75rem` | 700 | — | 0.1em |

**Weight 500 for every large heading.** Heavy weight at large size looks cheap.
**Uppercase only** for the hero and the closing CTA — every other heading is sentence
case.

Measures: `--sx-measure-lede` 34ch, `--sx-measure-body` 46ch, `--sx-measure-narrow`
32ch. Keep copy to a heading plus **two lines at most** per card.

---

## Spacing

One 4px scale. All padding and margin comes from it.

| Token | Value | Typical use |
|-------|-------|-------------|
| `--sx-space-1` | 4px | Focus offsets, hairline gaps |
| `--sx-space-2` | 8px | Tight inline gaps, nav padding |
| `--sx-space-3` | 16px | Float inset, mobile menu rows |
| `--sx-space-4` | 24px | Gutter, card margin, paragraph spacing |
| `--sx-space-5` | 32px | Card padding (phone), button padding |
| `--sx-space-6` | 48px | Card padding (desktop), section base |
| `--sx-space-7` | 64px | Hero bottom padding, large button |
| `--sx-space-8` | 96px | Section padding |
| `--sx-space-9` | 128px | Reserved for extra-tall sections |

`--sx-gutter` (24px) for phone edges, `--sx-gutter-lg` (`clamp(2rem, 6vw, 6rem)`) for
desktop.

---

## Borders, radius, shadow

| Token | Value | Rule |
|-------|-------|------|
| `--sx-border-width-none` | `0` | **Cards have no border** |
| `--sx-border-width-hairline` | `1px` | Band dividers and underlined links only |
| `--sx-border-color` | `rgba(255,255,255,0.08)` | Hairlines on dark |
| `--sx-radius-none` | `0` | **Cards and buttons — always** |
| `--sx-radius-round` | `9999px` | **Only** the floating WhatsApp button |
| `--sx-shadow-none` | `none` | Default for everything |
| `--sx-shadow-subtle` | `0 10px 30px rgba(0,0,0,0.45)` | **Only** the floating button |
| `--sx-focus-width` | `3px` | Focus rings |
| `--sx-focus-width-sm` | `2px` | Focus rings on small chrome |

Square corners and flat surfaces are the look. A rounded card or a drop shadow is the
fastest way back to looking like a template.

---

## Layout

| Token | Value | Use |
|-------|-------|-----|
| `--sx-content-max` | `82rem` | Hero and wide sections |
| `--sx-band-max` | `60rem` | Typographic bands |
| `--sx-closing-max` | `48rem` | Centred closing block |
| `--sx-card-max` | `32rem` | White card, desktop |
| `--sx-media-max` | `120rem` | Caps upscaling of 1024px sources |
| `--sx-hero-min` | `100svh` | Hero height |
| `--sx-section-min-phone` | `56vh` | Photo height, phone |
| `--sx-section-media-max-phone` | `30rem` | Photo cap, phone |
| `--sx-section-min-desktop` | `min(92vh, 56rem)` | Feature height, desktop |
| `--sx-card-overlap` | `-5rem` | Card lift over photo edge, phone |
| `--sx-header-offset` | `57px` | Cancels the app shell's `pt-[57px]` |

---

## The card pattern

The repeating unit: **media, one solid white card.**

- Solid white, `--sx-radius-none`, `--sx-shadow-none`, no border, no blur
- Contains: eyebrow, heading, ≤2 lines of body, one underlined link

**Desktop (≥900px):** card overlays the media, `--sx-card-max` wide, alternating left
and right (`.feature--right`), section at `--sx-section-min-desktop`.

**Phone:** the card must *not* cover the photo — that hides the image. The media takes
its own height (`--sx-section-min-phone`), then the card follows in flow with
`margin-top: var(--sx-card-overlap)` so it overlaps only the bottom edge.

Repeat the pattern rather than inventing per-section layouts. A section with no
suitable photograph becomes a **typographic band** on `--sx-bg-alt` instead — never
stretch an ill-fitting image to fill one.

---

## Image treatment

Source photos are **1024px wide**, bright and busy. One grade for all of them:

```css
filter: brightness(var(--sx-img-brightness))    /* 0.72 */
        saturate(var(--sx-img-saturate))        /* 0.74 */
        contrast(var(--sx-img-contrast));       /* 1.06 */
```

Moody, not murky — the subject must stay clearly readable. Sources that are already
dark (underwater, aqua gym) take `.media__img--lift` instead, which backs off to
`brightness 0.94 / saturate 0.8`; the standard grade buries them.

### Scrim

| Token | Value |
|-------|-------|
| `--sx-opacity-scrim-soft` | 0.12 |
| `--sx-opacity-scrim-mid` | 0.45 |
| `--sx-opacity-scrim-strong` | 0.6 |
| `--sx-opacity-scrim-max` | 0.94 |

Phone: a light vertical wash (atmosphere only — it holds up no text there).
Desktop: a directional gradient darkening toward whichever edge the card sits on.

### Section transitions

Every photo section fades into the canvas at **both** edges, via `::before` and
`::after` on `.feature__media` at `--sx-fade-size` (`clamp(3rem, 9vw, 7rem)`), so two
photo sections never meet on a hard cut. This is not optional — it is what makes the
page read as one piece rather than stacked blocks.

Also required: WebP, explicit `width`/`height` to prevent layout shift,
`loading="lazy"` below the fold (**never** on the hero), `decoding="async"`.

### Outstanding placeholders

| Section | Current | Needs |
|---------|---------|-------|
| Hero video | none — poster only | `assets/video/hero.webm` + `hero.mp4`, under ~3MB |
| All four features | existing `swimmer-*.webp` | 2000px+ originals |
| Location band | no photo | A real Cap Sur Ville photograph |

---

## Motion

One duration, one easing, and a single switch that turns it all off.

| Token | Value | Use |
|-------|-------|-----|
| `--sx-duration` | `200ms` | Hovers, fades, the floating button |
| `--sx-duration-slow` | `800ms` | Scroll reveals |
| `--sx-ease` | `cubic-bezier(0.4, 0, 0.2, 1)` | Everything interactive |
| `--sx-ease-out` | `ease-out` | Reveals |
| `--sx-reveal-shift` | `1.25rem` | Reveal travel |

Reveals run through `IntersectionObserver` in the component, applied via
`[data-reveal]`, guarded with `isPlatformBrowser` so prerendering is unaffected.

Under `prefers-reduced-motion: reduce`, the token block sets all durations to `0ms`
and the shift to `0` — **one change disables motion everywhere**, no per-rule
overrides. The hero video is also paused.

---

## Opacity

| Token | Value | Use |
|-------|-------|-----|
| `--sx-opacity-hidden` | 0 | Pre-reveal, hidden float |
| `--sx-opacity-full` | 1 | Revealed |
| `--sx-opacity-scrim-*` | see above | Image scrims |

---

## Header and footer

Both are shared with signed-in pages, so each renders a public variant keyed off
`isPublicUrl()`. Dashboard, admin, coach and the auth screens keep their original
chrome.

**Header (public):** a `SwimXpert` wordmark in Archivo — not the round logo, which
stays as the favicon and on signed-in pages.

Six links only: **Lessons, Level Finder, Locations, About, Gallery, FAQ**, then
**Log in** (or Dashboard/Admin plus Log out when signed in), then one white WhatsApp
button. Certificates and Contact live in the footer. Sign Up is not in the nav — the
login page carries "New here? Create an account".

Resist adding links here. A long nav is the fastest way to make the page ordinary.

**Footer (public):** four columns — wordmark and one line, Lessons, More, Get in
touch. No Login or Sign Up, and none of the blurred blue orbs from the old design.

---

## How often to ask for WhatsApp

It is the goal, but repetition cheapens it:

- **Hero** — one button
- **Closing** — one button
- **Header** — one button, far right
- **Floating button** — phone only, and only **once the hero has scrolled away**
  (`opacity: 0`, `pointer-events: none`, `aria-hidden` over the hero, since the hero
  already asks)
- **Every other section** — at most one quiet underlined link, never a button

```
https://wa.me/96176144927?text=Hi%2C%20I%27d%20like%20to%20book%20a%20swimming%20lesson%20for%20my%20child
```

---

## Non-negotiable constraints

- **No inline scripts** — CSP is `script-src 'self'` with no `unsafe-inline` or nonce
- **No external images, fonts or scripts** — everything under `src/assets`
- Self-hosted fonts only (`font-src 'self'`)
- Keep every route, SEO tag, canonical URL and the JSON-LD intact
- Prerendering must keep working — `npm run build` prerenders 9 routes
- The app shell already provides `<main id="main-content">`; never nest another
- Body text contrast **≥ 4.5:1**, everywhere, verified not guessed
- Angular's template parser doesn't know every HTML entity — `&frac12;` renders raw.
  Use literal characters (`½`) instead.
