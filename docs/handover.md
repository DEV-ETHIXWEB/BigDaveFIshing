# Big Dave's Fishing Adventures, Handover

Status: **NOT READY FOR LAUNCH**, see [Blocking items](#blocking-items).

Everything in the build is finished and verified. What is outstanding is client-supplied:
credentials, content, and confirmation of a few facts nobody on this side can verify.

---

## 1. Architecture summary

| Piece         | What it is                                                                |
| ------------- | ------------------------------------------------------------------------- |
| Framework     | Astro 7, SSR, deployed on Vercel (`@astrojs/vercel` adapter)              |
| UI            | Astro components + a few React islands (nav, booking form, waiver form)   |
| Styling       | Tailwind CSS v4 via `@tailwindcss/vite`                                   |
| Images        | `astro:assets` + sharp, quality raised to 90 (`src/lib/image-service.ts`) |
| Database      | Turso (libSQL). Falls back to a local file at `./data/waivers.db` in dev  |
| Outbound mail | SMTP2GO / Resend / Postmark over HTTP, whichever key is present           |
| Scheduling    | Vercel cron, daily 13:00 UTC → `/api/cron/waiver-digest`                  |

### The two things that carry business data

**Waivers.** Guest signs at `/waivers/lodge` or `/waivers/fishing-adventure` →
`POST /api/waivers` → Turso. Dave reads them at `/admin/waivers`, and a daily digest email
goes out with a CSV attached. Group links carry a `?g=` code so a whole party signs without
typing anything.

**Booking enquiries.** The homepage booking form → `POST /api/booking` → email to
`WAIVER_DIGEST_TO`. The form only shows its confirmation once the mail provider has
confirmed acceptance; on any failure it shows the phone number instead.

> The enquiry form (`BookingForm.tsx`) is placed on `/contact`, below the phone/email/address
> block, for a visitor who'd rather not call. Phone is still the primary call to action on
> that page. `BookingCTA*.astro` and `BookingFormDesktop.tsx` remain unused - see
> [Known limitations](#3-known-limitations-and-outstanding-issues).

### Access control

`/admin/*` and `/api/admin/*` are gated in `src/middleware.ts` by a signed session cookie
issued at `/admin/login`. If `ADMIN_USER` or `ADMIN_PASSWORD` is unset, the whole area
returns 503 rather than opening. Login is rate-limited and compares credentials in constant
time. `/api/cron/waiver-digest` is outside that gate and is authorised by `CRON_SECRET`
instead, because a scheduler has no cookie.

**Two kinds of admin identity share that one gate.** `ADMIN_USER`/`ADMIN_PASSWORD` is the
**master** account, exactly as above. Master can also create **staff** logins at
`/admin/staff` - real rows in a `staff_accounts` table (scrypt-hashed passwords, via
`src/lib/password-hashing.ts`), signed into the _same_ `/admin/login` form with their
email instead of a username. Both identities validate through `validAdminSession()` in
`src/lib/admin-auth.ts`, which returns `{role: 'master'}` or `{role: 'staff', id}` rather
than a boolean, and `src/middleware.ts` puts that on `context.locals.admin` for every
route to read - never something a request can supply itself. Removing a staff row revokes
their session on their very next request: middleware re-checks `staff_accounts` exists
for every staff cookie, not just the signature.

**Every admin action carries the acting admin's own saved signature**, automatically.
Each admin (master or staff) draws a signature once at `/admin/signature`, stored in
`admin_signatures` keyed by `'master'` or `` `staff:<id>` ``; there is no re-signing
step anywhere else. Archiving/deleting/restoring a waiver, creating/deleting a team link,
creating/removing a staff login, and sending the digest each log a row to `admin_actions`
(who, what, when) via `src/lib/admin-signature.ts`'s `logAdminAction()`, shown on
`/admin/waivers` under "Recent activity." An admin with nothing saved yet still acts
normally; the log just shows "No signature on file" rather than fabricating one. This
reuses the guest waiver signature's own capture widget (`SignaturePad.tsx`) and PNG
validation approach unmodified - the guest-facing signing flow itself was not touched.

**Customer accounts** (`/login`, `/signup`, `/account`) are a separate, later addition -
a real `customers` table (name, email, scrypt-hashed password), a second signed session
cookie (`big_dave_customer`, distinct from the admin one on purpose), its own rate limit
bucket so hammering one login can't lock out the other, and its own required
`CUSTOMER_SESSION_SECRET`. See `src/lib/customer-auth.ts` and `customer-password.ts`.
There is currently nothing behind an account beyond the account page itself - no cart, no
booking tied to a login, no members content - so before this goes further, decide what a
signed-in customer is actually for.

---

## 2. Environment variables

Names only, values go in the Vercel project settings, never in the repo. `.env.example` is
the current, annotated copy; this table is the summary.

| Variable                  | Required?                    | Owner  | What breaks without it                                                                                                                 |
| ------------------------- | ---------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `TURSO_DATABASE_URL`      | **Yes (production)**         | Dev    | Waivers try to write to a local file on a read-only filesystem, every waiver 500s                                                      |
| `TURSO_AUTH_TOKEN`        | **Yes (production)**         | Dev    | Same as above                                                                                                                          |
| `ADMIN_USER`              | **Yes**                      | Dev    | `/admin` returns 503; Dave cannot read waivers                                                                                         |
| `ADMIN_PASSWORD`          | **Yes**                      | Dev    | Same as above                                                                                                                          |
| `ADMIN_SESSION_SECRET`    | **Yes**                      | Dev    | Session cookie falls back to being signed with the password, forgeable offline                                                         |
| `CUSTOMER_SESSION_SECRET` | **Yes**                      | Dev    | `/api/customer/*` refuses outright (503) - no fallback exists, unlike admin                                                            |
| `SMTP2GO_API_KEY`         | **Yes** (or Resend/Postmark) | Dev    | Booking form answers 503; waiver digest refuses to run                                                                                 |
| `WAIVER_DIGEST_FROM`      | **Yes**                      | Client | Same as above. Must be a sender the provider has verified                                                                              |
| `WAIVER_DIGEST_TO`        | **Yes**                      | Client | Leads and rosters have nowhere to go                                                                                                   |
| `CRON_SECRET`             | **Yes**                      | Dev    | Scheduled digest disabled (manual button still works)                                                                                  |
| `PUBLIC_SITE_URL`         | **Yes**                      | Dev    | Canonicals, `og:image` and `sitemap.xml` fall back to the request hostname, which on Vercel can be the internal `*.vercel.app` address |
| `VERCEL_ENV`              | Set by Vercel                | ,      | Decides whether a deployment may be indexed. Do not set by hand                                                                        |

**Rotation note.** These are all read through `process.env` at request time
(`src/lib/env.ts`), not baked in at build. Changing one in the Vercel dashboard takes effect
without a rebuild. `ADMIN_SESSION_SECRET` is the exception in effect, not mechanism,
rotating it signs everyone out, which is the intended way to force re-login.

---

## 3. Known limitations and outstanding issues

Listed explicitly rather than left implicit.

1. **The booking form is now placed on `/contact`.** It was previously a dead form that
   `console.log`ed enquiries and showed "Thanks, we got it" to every visitor; it now posts
   to a real endpoint and only confirms on a confirmed send. It sits below the existing
   phone/email/address block as the alternative, not the replacement - phone stays the
   page's primary call to action. `BookingCTA.astro`, `BookingCTADesktop.astro` and
   `BookingFormDesktop.tsx` are still unused; either place one on the homepage too, or
   delete them along with the plain `BookingForm.tsx` copy if a single placement is enough.

2. **The end-to-end test send has not been performed.** The mail path is wired, validated
   and its failure modes are handled, but no real message has been pushed through
   `/api/booking` or the digest to confirm it lands in an inbox. **The checklist treats this
   as blocking, and so should you**, "verified" means an email arrived, not that the code
   looks right. Do it against the production URL once the client's credentials are in.

3. ~~Orphaned components from an unfinished desktop refactor.~~ **Resolved.** Twenty-two
   components that nothing rendered have been deleted: the desktop-variant set
   (`FooterDesktop`, `HeaderDesktop`, `HeroDesktop`, `GalleryDesktop`, `OfferingsDesktop`,
   `ProofDesktop`, `RatesSnapshotDesktop`, `SponsorsDesktop`, `WhoDaveIsDesktop`,
   `DayLooksLikeDesktop`), their mobile counterparts that had also fallen out of use
   (`Offerings`, `RatesSnapshot`, `WhoDaveIs`, `Proof`), and a second wave the first
   deletion exposed (`Header`, `MobileMenu`, `HeaderVignette`, `BadgeLogo`, `BottomTabBar`,
   `PlaceholderPhoto`, `RodIcon`, `TornBottom`). Build, typecheck and lint stayed green and
   every route still renders. They are in git history if any is ever wanted back.

   The four booking components (`BookingCTA`, `BookingCTADesktop`, `BookingForm`,
   `BookingFormDesktop`) were deliberately **kept** pending the decision in §3.1.

4. **Video gallery links nowhere.** All six entries in `src/lib/videos.ts` have `url: null`.
   This matches the live site, which also links none of them. Supply the YouTube URLs and
   the cards become links with no other change.

5. **Sponsor logos don't link out, and one is missing.** Matches the live site. Pro-Cure
   Bait Scents is a real sponsor whose logo could not be recovered from the old host, see
   the note in `src/lib/sponsors.ts`.

6. **No analytics, ad tracking, or consent banner.** None is installed. If GA4/GTM or a Meta
   Pixel is wanted, it needs to go in along with a cookie banner and a privacy policy,
   none of which exist yet. **Nothing on the site currently sets a tracking cookie**, which
   is why the absence of a banner is correct today and will not be once tracking lands.

7. **No error monitoring.** Failures land in Vercel's runtime logs and nowhere else. The
   `/500` page writes the error to the log and will show the detail to anyone who appends
   `?diag=<CRON_SECRET>`. Wiring up Sentry (or equivalent) is a small job and worth doing.

8. **`geo` and opening hours are absent from the LocalBusiness schema.** They previously
   carried invented coordinates and a made-up 06:00–18:00. Removed rather than guessed,
   confirm the real values with the client and add them back in `src/layouts/Layout.astro`.

9. **Facebook URL is `null`.** It was pointing at `https://www.facebook.com/`, Facebook's
   own home page, from every "Follow us" link and from `sameAs` in structured data. Every
   consumer now hides the link while it is null. Set it in `src/lib/business.ts` and all six
   places light up.

10. **In-memory rate limiting.** The waiver, booking and login throttles are per-instance
    maps. On serverless that means a spread-out attacker gets more than the stated number.
    Fine for this traffic; move to the database if abuse becomes real.

    Separately, `callerKey()` (`src/lib/login-throttle.ts`) used to trust the _first_
    entry of `x-forwarded-for`, which is whatever the client itself claims, not what
    Vercel's edge observed. Confirmed locally: one spoofed header reset an active login
    lockout instantly, no distributed attack needed. Fixed to trust the _last_ entry, the
    one hop a client can't rewrite - see the function's own comment for the full
    reasoning. Worth knowing if this is ever pointed at a host other than Vercel.

11. **Photos are web-sized copies** pulled from the old WordPress host, mostly 800–1500px on
    the long edge. Drop hi-res originals into `src/assets/photos/` under the same filenames
    and nothing else changes.

---

## 4. Deploy steps

```bash
npm ci
npm run build          # must finish with zero errors
```

Vercel builds from the repo. Before the first production deploy:

1. Set every **Yes** variable from §2 in Vercel → Project → Settings → Environment
   Variables, scoped to **Production**.
2. Create the Turso database and paste its URL and token in.
3. Verify the sending address in the mail provider (SMTP2GO: Sending → Verified Senders).
4. Point the custom domain, confirm SSL is issued.
5. Run the smoke test in §6.

---

## 5. Troubleshooting

| Symptom                                    | Where to look                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Every page 500s                            | `GET /api/health`, reports which env vars are present and whether the DB opens                     |
| A 500 with no detail                       | Append `?diag=<CRON_SECRET>` to the failing URL to see the stack trace                             |
| `/admin` returns 503                       | `ADMIN_USER` or `ADMIN_PASSWORD` missing on the deployment                                         |
| Login always fails with the right password | Check for whitespace in the Vercel value; comparison is exact                                      |
| Booking form says "couldn't send"          | Vercel runtime log, `[booking]` prefix, names whether it was config or a provider rejection        |
| Digest never arrives                       | `/admin/waivers` → "Email roster now" reports the reason. Then check spam                          |
| Digest lands in spam                       | Single verified sender doesn't align SPF/DKIM, verify the domain. See `docs/waiver-email-setup.md` |
| Preview deployment appearing in Google     | `VERCEL_ENV` must be `production` only on production; previews serve `Disallow: /`                 |

---

## 6. Production smoke test

Run against the **real production URL**, not a preview. Staging passing is not sufficient.

- [ ] Homepage loads, console clean
- [ ] One inner page loads (`/oregon-rates-packages`)
- [ ] `/robots.txt` allows crawling and names the sitemap on the real domain
- [ ] `/sitemap.xml` lists the real domain, no `*.vercel.app`
- [ ] A made-up URL shows the branded 404, not Astro's default
- [ ] Sign a test waiver end-to-end → row appears in `/admin/waivers`
- [ ] "Email roster now" → email actually arrives in the client's inbox (check spam)
- [ ] Booking enquiry on `/contact` → email actually arrives
- [ ] `curl -I` the homepage and confirm CSP, HSTS, X-Frame-Options, Referrer-Policy
- [ ] Rich Results Test on the homepage → zero errors

---

## 7. Third-party accounts

| Account      | Currently owned by | Should move to                                |
| ------------ | ------------------ | --------------------------------------------- |
| Turso        | EthixWeb           | Client, or bill through EthixWeb by agreement |
| SMTP2GO      | EthixWeb           | Client, or bill through EthixWeb by agreement |
| Vercel       | EthixWeb           | Client, or bill through EthixWeb by agreement |
| Domain / DNS | Client             | ,                                             |

**Flag:** everything above except the domain is on an EthixWeb-owned account today. Decide
per account whether it transfers or stays, and write the answer here before sign-off.

---

## 8. Pre-launch QA & security pass (2026-09-11)

Run against EthixWeb's own Full-Stack Ready Checklist, a 5-part security audit (secret
leaks, personal-data flow, pre-deploy hardening, deep auth/logic review, attacker's-eye
review), and a general production-readiness pass - every item actually tested (curl,
Playwright, real browser interaction), not read and assumed correct. Full detail lives in
this session's transcript; summary here so the next person doesn't have to re-derive it.

**Fixed, real bugs:**

- `/contact` overflowed horizontally at 320px width with the email address visibly cut off
  mid-word - a CSS grid sizing quirk (`min-w-0` missing on the grid item) stopped
  `break-words` from ever getting a chance to apply. One class fixed it site-wide (the
  footer's own email link was unaffected - different container).
- Footer copyright line rendered as "2026Big Dave's..." with no space, because Astro
  concatenates adjacent expressions on separate lines with nothing between them. Fixed
  with the same `{' '}` pattern already used elsewhere in the codebase - a plain joined
  line looked right in source but Prettier reflows it back apart on the next format run,
  so the explicit space is required, not optional.
- `login-throttle.ts`'s rate limiter trusted the first `x-forwarded-for` entry (client-
  controlled) instead of the last (Vercel-controlled) - see item 10 above.
- A `localStorage` write in `WaiverForm.tsx` persisted a guest's phone number in a key
  name, and nothing ever read it back. Dead code with a PII cost and no benefit; removed.
- Added real PNG magic-byte validation on the signature upload (`api/waivers.ts`) - the
  prior check only confirmed the string _claimed_ to be a PNG, not that it was one.
- **Self-caught regression, worth flagging explicitly:** that same PNG-validation fix
  first landed in `lib/waiver-validation.ts`, a module shared with the browser-side
  `WaiverForm.tsx`. It used Node's `Buffer`, which doesn't exist in a browser - the
  import crashed the React island's hydration outright, so the _entire_ public waiver
  form stopped responding to any input (not just the signature pad). Server-side `curl`
  tests of the API alone did not catch this; only driving the actual form in a real
  browser did. Moved the Buffer-using code into the API route itself, the only place
  that's genuinely server-only. Lesson: anything touching `lib/waiver-validation.ts`
  needs a real-browser check, not just an endpoint test, because it ships to the client.
- The booking and waiver digest emails now carry the company logo (`public/email-logo.png`
  - a PNG, deliberately, since Outlook desktop and others don't render the site's own
    WebP) as an absolute URL, with the existing text branding kept as a visible fallback for
    clients that block remote images by default.

**Verified clean (tested, not assumed):**

- No hardcoded secrets, no debug logging, `.env` gitignored.
- Security headers (CSP/HSTS/X-Frame-Options/etc.), CSRF (Astro's same-origin check),
  error pages never leak a stack trace, `/api/health` never leaks a secret value.
- Auth: every `/admin/*` and `/api/admin/*` route correctly rejects no cookie, a garbage
  cookie, and a tampered signature; login lockout triggers at exactly 8 failed attempts as
  documented.
- SQL injection: every query is parameterized; the only string-built SQL fragments are
  `?` placeholder lists, never interpolated values.
- Duplicate-waiver protection (`waivers_one_submission_per_guest`) holds under a real
  retry.
- Zero console errors, zero broken images, zero failed requests, zero horizontal overflow
  across all 11 pages, 5 viewport widths (320/375/768/1280/1920), and all three browser
  engines (Chromium, WebKit, Firefox) - 165 checks, run twice (before and after the fixes
  above).
- Full end-to-end waiver signing tested through an actual browser: fill form, draw
  signature, submit, confirm the row lands correctly.

**Not fixed, and why (all pre-existing, all already listed above under Known
limitations):** the video/sponsor/Facebook content gaps (client-owned), missing
analytics/error monitoring (never asked for, no IDs to install), and the deferred
`path-to-regexp` advisory from the previous session (forcing it breaks the Astro 7 build
for a build-time-only, non-attacker-reachable issue). Nothing here was fabricated to make
a checklist look more complete than it is.

---

## Blocking items

See `docs/client-requirements.md` for the assignable punch list.
