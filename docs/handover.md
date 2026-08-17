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

> ⚠️ The booking form components (`src/components/home/BookingCTA*.astro`,
> `BookingForm*.tsx`) are **not currently placed on any page**. They work, and the endpoint
> behind them is live, but nothing renders them. See
> [Known limitations](#3-known-limitations-and-outstanding-issues).

### Access control

`/admin/*` and `/api/admin/*` are gated in `src/middleware.ts` by a signed session cookie
issued at `/admin/login`. If `ADMIN_USER` or `ADMIN_PASSWORD` is unset, the whole area
returns 503 rather than opening. Login is rate-limited and compares credentials in constant
time. `/api/cron/waiver-digest` is outside that gate and is authorised by `CRON_SECRET`
instead, because a scheduler has no cookie.

---

## 2. Environment variables

Names only, values go in the Vercel project settings, never in the repo. `.env.example` is
the current, annotated copy; this table is the summary.

| Variable               | Required?                    | Owner  | What breaks without it                                                                                                                 |
| ---------------------- | ---------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `TURSO_DATABASE_URL`   | **Yes (production)**         | Dev    | Waivers try to write to a local file on a read-only filesystem, every waiver 500s                                                      |
| `TURSO_AUTH_TOKEN`     | **Yes (production)**         | Dev    | Same as above                                                                                                                          |
| `ADMIN_USER`           | **Yes**                      | Dev    | `/admin` returns 503; Dave cannot read waivers                                                                                         |
| `ADMIN_PASSWORD`       | **Yes**                      | Dev    | Same as above                                                                                                                          |
| `ADMIN_SESSION_SECRET` | **Yes**                      | Dev    | Session cookie falls back to being signed with the password, forgeable offline                                                         |
| `SMTP2GO_API_KEY`      | **Yes** (or Resend/Postmark) | Dev    | Booking form answers 503; waiver digest refuses to run                                                                                 |
| `WAIVER_DIGEST_FROM`   | **Yes**                      | Client | Same as above. Must be a sender the provider has verified                                                                              |
| `WAIVER_DIGEST_TO`     | **Yes**                      | Client | Leads and rosters have nowhere to go                                                                                                   |
| `CRON_SECRET`          | **Yes**                      | Dev    | Scheduled digest disabled (manual button still works)                                                                                  |
| `PUBLIC_SITE_URL`      | **Yes**                      | Dev    | Canonicals, `og:image` and `sitemap.xml` fall back to the request hostname, which on Vercel can be the internal `*.vercel.app` address |
| `VERCEL_ENV`           | Set by Vercel                | ,      | Decides whether a deployment may be indexed. Do not set by hand                                                                        |

**Rotation note.** These are all read through `process.env` at request time
(`src/lib/env.ts`), not baked in at build. Changing one in the Vercel dashboard takes effect
without a rebuild. `ADMIN_SESSION_SECRET` is the exception in effect, not mechanism,
rotating it signs everyone out, which is the intended way to force re-login.

---

## 3. Known limitations and outstanding issues

Listed explicitly rather than left implicit.

1. **The booking form is built but not placed.** It was previously a dead form that
   `console.log`ed enquiries and showed "Thanks, we got it" to every visitor. It now posts
   to a real endpoint and only confirms on a confirmed send. Nothing renders it, though,
   the contact page deliberately carries phone/email/address instead. **Decide before
   launch:** put the working form on `/contact` (and/or the homepage), or delete the four
   components and `/api/booking` with them. Leaving it as-is is the one option that will
   confuse the next person.

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
- [ ] Booking enquiry (if the form is placed) → email actually arrives
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

## Blocking items

See `docs/client-requirements.md` for the assignable punch list.
