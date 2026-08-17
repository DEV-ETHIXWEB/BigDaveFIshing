# Client Requirements, Big Dave's Fishing Adventures

Checklist §08. What is blocking launch, and who owns closing it.
Replaces a generic "credentials required" note with a specific, assignable punch list.

Last reviewed: 2026-08-16

---

## Credentials & access

| Requirement                              | Status  | Owner  | Notes                                                                               |
| ---------------------------------------- | ------- | ------ | ----------------------------------------------------------------------------------- |
| Turso database (URL + auth token)        | Pending | Dev    | Free tier is enough. Create, then paste both into Vercel → Production               |
| `ADMIN_USER` / `ADMIN_PASSWORD`          | Pending | Dev    | Agree the password with Dave, he is the one who signs in                            |
| `ADMIN_SESSION_SECRET`                   | Pending | Dev    | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`          |
| `CRON_SECRET`                            | Pending | Dev    | Same generator. Vercel sends it automatically once the variable exists              |
| Mail provider API key (SMTP2GO)          | Pending | Dev    | See `docs/waiver-email-setup.md`                                                    |
| **Verified sending address**             | Pending | Client | Which address the digest and enquiries come FROM. Client must click the verify link |
| **Recipient inbox(es)**                  | Pending | Client | Where leads and rosters land. Must be an inbox Dave actually reads                  |
| Domain / DNS access                      | Pending | Client | Needed to point `bigdavesfishing.com` at Vercel and to publish SPF/DKIM             |
| `PUBLIC_SITE_URL`                        | Pending | Dev    | Set to the final domain, no trailing slash                                          |
| Vercel project (production env vars set) | Pending | Dev    | Everything above, scoped to Production                                              |

### Not applicable to this project

Marked as genuinely absent, not unchecked:

- **Analytics / GTM access**, no analytics is installed. If the client wants GA4, this
  moves to Pending and brings a cookie banner and privacy policy with it.
- **Google Ads conversion ID**, no ad tracking installed.
- **reCAPTCHA / Turnstile keys**, no CAPTCHA. Public endpoints are rate-limited instead.
- **CMS / WordPress admin**, this is a static/SSR build, no CMS.
- **Call-tracking account**, none. The site uses the real phone number directly.
- **Webhook URLs / secrets**, no inbound webhooks.
- **CRM**, none. Leads go to email.

---

## Content & assets still owed

| Requirement                   | Status  | Owner  | Notes                                                                      |
| ----------------------------- | ------- | ------ | -------------------------------------------------------------------------- |
| Facebook page URL             | Pending | Client | Currently `null`, so every "Follow us" link is hidden rather than wrong    |
| Video URLs (6)                | Pending | Client | `src/lib/videos.ts`. Cards become links automatically once filled          |
| Pro-Cure Bait Scents logo     | Pending | Client | The one sponsor logo that could not be recovered from the old host         |
| Hi-res original photos        | Pending | Client | Current ones are 800–1500px web copies from WordPress                      |
| Real business logo file       | Pending | Client | `BadgeLogo.astro` is a drawn placeholder mark                              |
| Confirmed opening hours       | Pending | Client | Removed from schema rather than guessed. Needed to put `openingHours` back |
| Geo coordinates for the lodge | Pending | Dev    | Can be derived from the address once the client confirms it is exact       |
| Privacy policy / terms copy   | Pending | Client | Only strictly required if analytics or ad tracking is added                |

---

## Facts to confirm with the client (checklist §09 cross-check)

These are all currently taken from the live site. Someone at the client needs to say yes.

- [ ] Business name: **Big Dave's Fishing Adventures**
- [ ] Phone: **(503) 538-5607**
- [ ] Email: **bigdave@bigdavesfishing.com**
- [ ] Address: **17175 Wilson River Hwy, Tillamook, OR 97141, USA**
- [ ] Hosts: **Dave and Leslie Manners**
- [ ] Service area: **Wilson, Trask, Kilchis rivers and Tillamook Bay**
- [ ] Lodge nightly rate: **$75 + tax per person**, sleeps up to 6
- [ ] Season windows (Spring Chinook May–June, Summer Kings Jul–Aug, Fall Chinook
      mid-Sep–Dec, Winter Steelhead Dec–mid-Apr)
- [ ] Waiver wording is the client's real waiver, approved by them
- [ ] No trip prices are published anywhere, the site says "call for a quote" throughout,
      matching the live site. Confirm that is still what they want.

**NAP verified consistent** across page content, footer, contact page, metadata and
LocalBusiness schema, all read from `src/lib/business.ts`, so there is one source and no
opportunity to drift. Location accuracy checked: Tillamook throughout, no city names from
another project anywhere in the codebase.

---

## Decisions needed from EthixWeb (not the client)

- [ ] **Put the booking form on the site, or delete it.** It works now, but nothing renders
      it. See `docs/handover.md` §3.1.
- [ ] **Run the end-to-end test send** against production once credentials are in. This is
      the item the checklist names first and the one most likely to be skipped. See
      `docs/handover.md` §3.2.
- [x] ~~Delete the orphaned desktop-refactor components.~~ Done, 22 unreferenced components
      removed, build/typecheck/lint green, every route still renders.
- [ ] **Error monitoring**, wire up Sentry or accept Vercel logs only.
- [ ] **Account ownership**, which third-party accounts transfer to the client.
