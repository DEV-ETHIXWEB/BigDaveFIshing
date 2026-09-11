# Big Dave's Fishing Adventures

Marketing site for a guided steelhead and salmon outfit on the Oregon coast, which also
runs the Wilson River Lodge. The site has one job: get a phone call or a booking enquiry.
Every screen keeps the phone number and a booking action within reach.

Built as a static site from an illustrated, torn-paper art direction - cream parchment,
black ink, and hand-drawn scenes that tear open into one another between sections.

## Stack

|                     |                                             |
| :------------------ | :------------------------------------------ |
| Framework           | Astro 7 (static output)                     |
| Interactive islands | React 19                                    |
| Styling             | Tailwind v4 (CSS-first `@theme`)            |
| Forms               | react-hook-form + zod                       |
| Icons               | lucide-react                                |
| Also installed      | GSAP, motion, ogl (available, not yet used) |
| Tooling             | ESLint, Prettier, Husky + lint-staged       |

Requires Node >= 22.12.

## Commands

```bash
npm install
```

```bash
npm run dev
```

| Command                            | Action                                   |
| :--------------------------------- | :--------------------------------------- |
| `npm run dev`                      | Dev server on `localhost:4321`           |
| `npm run build`                    | Production build to `./dist/`            |
| `npm run preview`                  | Preview the build locally                |
| `npm run lint`                     | ESLint                                   |
| `npm run format`                   | Prettier                                 |
| `node scripts/normalize-paper.mjs` | Re-process the illustrations (see below) |

## Layout of the code

```text
public/
  art/                      pre-encoded transparent WebP (generated - see below)
  fonts/                    self-hosted Rye
src/
  assets/images/            source illustrations
    originals/              pristine copies, never edited
  components/
    Header, Footer, StickyMobileBar, BadgeLogo, HeaderVignette
    TornEdge, TornBottom    the two section-transition primitives
    home/                   one component per homepage section
  layouts/Layout.astro      shell, meta, LocalBusiness JSON-LD
  lib/
    business.ts             phone, nav, service area - single source of truth
    torn-edge.ts            shared tear geometry
  styles/global.css         theme tokens, fonts, component utilities
scripts/normalize-paper.mjs image pipeline
```

## The homepage

Hero → About Big Dave → Guided Fishing Trips → Wilson River Lodge → What a Day Looks Like
→ Gallery → Reviews → Rates → Sponsors → Booking.

It works as a one-pager so a visitor can decide without clicking, while the deeper pages
hold the detail. Rates appear up front rather than buried, and the "what a day looks like"
section exists to remove the main hesitation for first-timers.

## Things worth knowing before you edit

### One parchment tone, enforced by a script

Every illustration was drawn on slightly different paper - from `#f0e5d6` to a much
browner `#d1b38b`. Stacked as full-bleed backgrounds, each join showed a hard horizontal
line. Chasing that per-section with gradients does not work and washes out the artwork.

`scripts/normalize-paper.mjs` fixes it at the source. It samples each image and applies a
per-channel gain that lands every parchment on one tone - **`#ece0cb`, which is also
`--color-cream`**. The transform is multiplicative, so near-black ink stays black and only
paper and midtones move. Dark-ground artwork (the About medallion: white linework on
black) is detected by its border and gets a levels adjustment instead, lifting its black
floor to `--color-ink` while pinning white at white.

> **If you change `--color-cream` or `--color-ink`, change `TARGET`/`INK` in that script to
> match and re-run it.** Otherwise the seams come back.

Originals live in `src/assets/images/originals/` and the script always reads from them, so
it is safe to re-run and is never cumulative.

### Two kinds of section transition

- **`TornEdge`** - a tear _filled_ with the colour of the section below, sitting at the
  bottom of the section above. Its straight edge lands on a matching colour and disappears;
  only the rip shows. Use where the next section is a **flat colour**.
- **`TornBottom`** - _masks_ the section along the rip so it genuinely ends there and the
  next section shows through. Use where the next section is **artwork**. `TornEdge` would
  leave a ~30px band of flat colour between the rip and the illustration.

Both draw from the same path in `lib/torn-edge.ts`, so they can't drift apart.

Two rules learned the hard way:

- Never put a flipped tear at the _top_ of a section - its straight edge lands on the
  boundary and creates exactly the line you're removing.
- Cropped (`object-cover`) illustrations use `object-top` / `object-right-top` so a section
  starts on the artwork's own pale top edge rather than a cut through mid-scene.

### The hero tears onto the dark section

The hero artwork's baked-in rip is drawn tearing open onto its own cream paper, so it could
never reveal the dark About section. The script cuts that paper to transparent, and About is
pulled up underneath (`mt-[-9.6%]`) so the illustrated tear reveals the dark ground through
it. Section stacking - hero above About above the day trip - keeps a rip from ever being
covered by what it reveals.

Astro's image pipeline flattens alpha on WebP conversion, and its PNG fallback was ~2MB for
the LCP image. So the transparent hero is pre-encoded to `public/art/` at three widths
(186kB at 1536w, 68kB on mobile) and used as a plain `<img srcset>`. Add a filename to
`TEAR_CUT` in the script to give another illustration the same treatment.

### Colour comes in two weights

`cedar` for accents on cream, `copper` for accents on ink. One mid-tone failed 4.5:1 on one
side or the other. Pick by background.

### lucide-react in `.astro` files

Pass `className`, never `class` - these are React components and silently drop an unknown
`class` prop. lucide also ships no brand icons, so the Facebook mark is an inline SVG.

### Waivers are a real, working system - not a mockup

`/waivers`, `/waivers/fishing-adventure`, and `/waivers/lodge` write real signed records to a
database, not a contact-form stand-in. This exists because Dave couldn't tell which guests
belonged to which group from a flat inbox of submissions.

- **Group linking.** Dave sends the group leader a link with a code on it -
  `…/waivers/fishing-adventure?g=turner-0814` - so every guest who signs through it is
  automatically stamped with that group. Nothing to type, nothing to typo. Anyone who lands on
  the page without a code still sees a manual "who booked your trip" fallback field.
- **Storage: libSQL, not a plain SQLite file.** This deploys to Vercel, whose functions have a
  read-only filesystem outside of a request and don't persist `/tmp` between invocations - a
  file-based DB (e.g. better-sqlite3) would lose every submission. libSQL speaks the same SQL
  and defaults to a local file (`./data/waivers.db`), so it works with zero setup right now.
  For a real deployment, create a free database at [turso.tech](https://turso.tech) and set
  `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` - same code, no changes, see `.env.example`.
- **Signature is a real drawn signature**, not a typed name - `SignaturePad.tsx`, plain
  Pointer Events (covers mouse/touch/pen in one path), exported as a PNG with the submission.
- **`/admin/waivers`** lists every signature grouped by group code, with a signature thumbnail
  and emergency contact per guest - the actual fix for the original problem. Gated by a real
  sign-in page at `/admin/login` (`src/middleware.ts`), not HTTP Basic Auth's browser popup:
  signing in issues a signed, `HttpOnly` session cookie (12 hours), there's a visible "Sign
  out" button, wrong passwords show a plain-English error, and repeated failures lock out for
  15 minutes (`src/lib/login-throttle.ts`). Checked against `ADMIN_USER` / `ADMIN_PASSWORD`;
  the admin area refuses to load if either is unset rather than defaulting to open. Set
  `ADMIN_SESSION_SECRET` in production - see `.env.example` - or the session cookie is signed
  with the admin password itself, which the login page will warn about on every visit until
  it's set.
- The rest of the site stays fully static (`output: 'static'`); only `/api/waivers` and
  `/admin/waivers` opt into on-demand rendering (`export const prerender = false`), which is
  why an adapter (`@astrojs/vercel`) is installed at all.
- Waiver body text in both pages is placeholder liability language, clearly marked `SAMPLE` in
  the source - replace with wording a lawyer has actually reviewed before this goes live.

## Accessibility and performance

Checked as the build went, by measuring the rendered page rather than by eye:

- Body text at 18px, 4.5:1 minimum contrast - including text sitting over illustrations,
  verified by sampling the artwork pixels behind each glyph.
- Visible keyboard focus, `prefers-reduced-motion` respected (the crossfade stops).
- Tap targets at least 44px; sticky tap-to-call and Book bar on mobile.
- Illustrations served as WebP; the hero is `fetchpriority="high"` with responsive `srcset`.
- `LocalBusiness` JSON-LD in the layout; real alt text on every illustration.

## Still to do before launch

The full, maintained punch list is **`docs/handover.md`** (architecture, every env var and
what breaks without it, troubleshooting, and a production smoke test) plus
`docs/client-requirements.md` for the assignable items. Highlights:

- **The booking form is now live on `/contact`,** below the phone/email/address block, for a
  visitor who'd rather not call - phone stays the page's primary action. It posts to a real,
  working `/api/booking` (validated, rate-limited, only confirms once the mail provider
  accepts it). `BookingCTA.astro` and the desktop variants remain unused; see handover.md §3.1
  for whether a homepage placement is also wanted.
- Three small content gaps, each documented at its source rather than silently guessed:
  Facebook URL (`lib/business.ts`), one sponsor logo (`lib/sponsors.ts`), and the video
  gallery's YouTube links (`lib/videos.ts`) all need something only the client can supply.
- **Waiver liability text needs legal review** before launch. It's the real wording pulled
  from the live site (`lib/waiver-text.ts`), not sample text - but the live site's own
  Fishing Adventure agreement is itself abbreviated, reproduced faithfully rather than
  invented around, and needs the unabridged version.
- **The Turso database doesn't exist yet.** Local dev works out of the box against a file
  (`./data/waivers.db`, created automatically on first run); production needs a free Turso
  account and two env vars, or submissions won't persist between serverless invocations.
- **The end-to-end mail send has never been tested against a real inbox.** Handover treats
  this as blocking, not optional - do it against the production URL once mail credentials
  are in.
- One transitive dependency (`path-to-regexp`, via `@vercel/routing-utils`) has a known ReDoS
  advisory that `npm audit` flags as high severity. It only runs at build time over this
  project's own fixed route patterns, not attacker-supplied input, and the only upgrade
  `npm audit fix --force` offers (`@astrojs/vercel@8.x`) requires Astro 5 and would break
  this Astro 7 site outright - left as-is rather than "fixed" into a broken build.
