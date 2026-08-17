# Waiver roster emails, setup

Everything is built. Nothing sends until the environment variables below exist. Until
then the dashboard behaves exactly as it does today and says, on the page, that email
isn't switched on.

Two things worth saying to Dave out loud before this goes live:

- **The inbox is not the archive.** The database stays the system of record. Deleting one
  of these emails loses nothing, every waiver is still in the dashboard.
- **Guest details in email are less protected than in the dashboard.** Email isn't
  encrypted end to end, and forwarding is one tap. That is a normal trade-off, and it's
  his call, but he should make it knowingly. It's why signature images stay out of the
  email and behind the login.

---

## 1. Pick a provider and verify a sender

Three are supported, SMTP2GO, Resend, Postmark. The code picks whichever key is set, in
that order. **Nothing sends from an unverified sender**, whichever you choose; the only
question is what you have to verify.

### Without a domain of your own, SMTP2GO

This is the path while `bigdavesfishing.com` isn't available to us.

1. Sign up at https://smtp2go.com
2. **Sending → Verified Senders → Single sender emails**, add the address you want the
   roster to come from, and click the link it emails you
3. **Settings → API Keys**, create one (it looks like `api-` + 32 characters)
4. Use that exact verified address as `WAIVER_DIGEST_FROM`

No DNS, no domain, works in a couple of minutes, and it can send to anyone.

One catch: SMTP2GO won't verify a single sender on a domain that publishes a strict DMARC
policy. If it refuses the address you picked, use a different one.

Resend is _not_ usable here, until you verify a domain it only sends from
`onboarding@resend.dev` and only to your own signup address, so it can't reach anyone
else's inbox.

### Once the real domain is available, verify the domain

Add `bigdavesfishing.com` in the provider's dashboard and publish the SPF and DKIM DNS
records it gives you.

Do this before Dave depends on the system. A single verified sender aligns neither SPF nor
DKIM with the From domain, so a meaningful share of these get filtered. An unverified or
misaligned sender lands in spam, Dave stops seeing the roster, and he quietly stops
trusting the system, which is worse than never having sent it.

## 2. Set the environment variables

Locally in `.env`, and on Vercel under **Project → Settings → Environment Variables**
(the `.env` file is never deployed). Descriptions are in `.env.example`.

| Variable                                                             | Example                       | Notes                                             |
| -------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------- |
| `SMTP2GO_API_KEY` _or_ `RESEND_API_KEY` _or_ `POSTMARK_SERVER_TOKEN` | `api-xxx`                     | Set one; first in this order wins                 |
| `WAIVER_DIGEST_FROM`                                                 | the address you verified      | Must be a verified sender, or the send is refused |
| `WAIVER_DIGEST_TO`                                                   | `bigdave@bigdavesfishing.com` | Comma-separate for more than one                  |
| `CRON_SECRET`                                                        | 64 hex chars                  | Vercel sends it to the cron route automatically   |
| `PUBLIC_SITE_URL`                                                    | `https://bigdavesfishing.com` | Used for the dashboard link inside the email      |

Generate `CRON_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Also still required, and the blocker for anything persisting at all: `TURSO_DATABASE_URL`
and `TURSO_AUTH_TOKEN`. Without them a deployed submission is written to a filesystem
that does not survive the request.

## 3. Test it

Sign a test waiver, then open `/admin/waivers` and press **Email roster now**. The page
tells you what happened, sent, nothing queued, missing configuration, or the provider's
own error message.

If it sends but doesn't arrive, it's deliverability, not the code: check spam, then
re-check that SPF and DKIM are actually published for the sending domain.

## 4. The schedule

`vercel.json` runs `/api/cron/waiver-digest` daily at **13:00 UTC, 6am Pacific**. Vercel
crons are UTC and do not follow daylight saving, so this drifts to 5am in winter; change
the `schedule` field if that matters.

The route refuses to run if `CRON_SECRET` is unset, rather than sitting open for anyone
to trigger.

---

## How it behaves

**What's in the email.** Party leader, trip date, and for every guest: name, phone,
email, emergency contact name and number, and when they signed. A CSV of the same roster
is attached for anyone who wants to sort or print it.

**What isn't.** The signature image. It's the legal artifact, not something anyone acts
on, and it's the one item that would genuinely hurt in a compromised inbox. It stays in
the database behind the admin session; the email carries a button through to it.

**What gets sent.** Every waiver that hasn't been emailed and hasn't been archived,
tracked per waiver in `emailed_at`, not by date window. So a failed send, or a day the
cron never fired, is picked up by the next successful run instead of being lost. `emailed_at`
is written only after the provider confirms; nobody is emailed twice.

**Archiving is separate and manual.** Pressing Archive sets `archived_at` and takes a
party off the active list. Nothing is deleted, and the Archived view restores anything.
It is deliberately not tied to the email: if the mail provider has a bad day, the
dashboard still clears and whoever is on admin isn't left wondering why the list stopped
working.

## Files

- `src/lib/email.ts`, the provider call: SMTP2GO, Resend or Postmark
- `src/lib/waiver-digest.ts`, what the email says (HTML, text, CSV)
- `src/lib/waiver-digest-send.ts`, one run: gather, send, then mark sent
- `src/pages/api/cron/waiver-digest.ts`, the scheduled trigger
- `src/pages/api/admin/send-digest.ts`, the dashboard button
- `src/pages/api/admin/archive.ts`, archive and restore
