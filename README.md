# Prime Estates Realty — websites for real estate brokerages

One codebase that gives each client brokerage its own property website and a private admin panel, all from a single deployment and database.

**Built with:** Next.js 15, Supabase (database, logins, photo storage), Tailwind CSS. Hosted on Netlify.

## How it fits together

- **Firms.** Each client is a row in the `firms` table: name, web address (slug), phone, city, areas, MahaRERA number, logo. Its website is at `/<slug>`, e.g. `/prime-estates`. The site root (`/`, `app/page.js`) is your own services page for brokerages (under the name Amaan); its contact form adds the visitor to Leads as Interested (`app/actions/contact.js`).
- **Platform admin (you).** A login with `app_metadata.role = 'admin'`. You see **Firms** and **Logins**, create firms and their logins, set passwords, pause firms, and can manage any firm's listings.
- **Firm logins.** `app_metadata.role = 'firm'`, linked to one firm in `firm_users`. A firm login sees only its firm's **Listings**, **Add listing**, **Enquiries**, **AI calls**, **WhatsApp write-up** and **Firm profile**.
- **Isolation in the database.** Row Level Security (`supabase/multi_tenant.sql`) stops a firm login from reading or changing another firm's listings, enquiries or photos, whatever the website code does. Photos live in a storage folder per firm.

**`CLIENT_SETUP.md`** covers adding a client and day-to-day tasks.

## Listing reels (Listings → Make reel)

Every listing has a **Make reel** button. It turns the listing's photos into a 1080×1920 Instagram reel with the headline, location, price, one fact per photo (BHK and size, amenities, floor) and a closing card with the firm's phone number and website, plus the MahaRERA numbers when filled in. Firms pick the photos and their order, the corner label (Just listed, Price drop, Sold…), speed and style (full screen or framed), preview it live, then download the MP4 or share it from a phone. A ready-to-paste caption with five hashtags is generated alongside. The video is encoded in the browser with WebCodecs ([Mediabunny](https://mediabunny.dev)), so it costs nothing per reel and nothing is uploaded; it works in Chrome, Edge and Safari. Reels have no sound, so firms add a trending song in Instagram when posting. Drawing code: `lib/reel.js`; screen: `components/admin/reel/ReelMaker.js`. Photos linked from other websites only work if that site allows it (CORS); uploaded photos and Unsplash always do.

## Project layout

New, larger features each live in their own folder under [`features/`](features/README.md), with their logic, admin screens, database setup and README together; `app/` only holds thin route files that point into them. Planned: automatic replies to Instagram and Facebook comments, an AI WhatsApp assistant, and email alerts and client emails (see [`features/README.md`](features/README.md)).

## Private inventory and firms without a website

Every listing has a **Show on the website** switch (on by default). Off = a private listing: the firm's team and the AI calling assistant see it, website visitors never do. The platform admin can also switch a firm's **Public website is live** off (Firms → the firm) for firms that only buy AI calling: their website is hidden, while their admin panel, listings and AI calls keep working. The voice agents' `search_listings` tool sends `x-voice-key` (= `VOICE_TOOL_SECRET`), and with it `/api/voice/listings` searches the firm's whole available inventory; without it, only what is public. Database: `supabase/inventory.sql`.

## AI calls (firm admin → AI calls)

Riya, an AI voice agent, phones a firm's clients in Hindi, English or Hinglish. Firms add clients by hand, upload a CSV (phone plus optional name, why calling, looking for), or press **AI call** on a website enquiry. Calls run one at a time; after each call the extracted requirement (buy/rent, area, project, BHK, budget, timeline, site visit, callback time) and the transcript appear on the page. Firm and contact details are passed per call as variables (`callVariables` in `lib/voice.js`). While talking, Riya searches that firm's listings (`/api/voice/listings`, prices and sizes in spoken English words) and looks up towers and areas (`/api/voice/places`, the knowledge base); both need the `x-voice-key` header (`VOICE_TOOL_SECRET`).

The platform admin picks each firm's voice on the firm's page:

| Voice | Runs on | Results | Settings |
| --- | --- | --- | --- |
| Sia, Simran | ElevenLabs agents over a Twilio number imported into ElevenLabs | The app reads each conversation from ElevenLabs | `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID_SIA`, `ELEVENLABS_AGENT_ID_SIMRAN`, `ELEVENLABS_PHONE_NUMBER_ID` |
| Riya on Sarvam (pilot) | Sarvam AI agent, Kavya voice, over a phone line connected in Sarvam (`lib/sarvam.js`) | Sarvam posts each finished call to `/api/voice/sarvam-webhook` | `SARVAM_AGENTS_API_KEY`, `SARVAM_CONNECTION_ID`, `SARVAM_AGENT_NUMBER` (optional `SARVAM_APP_VERSION`, see `.env.example`) |

Riya's prompts: `voice-agent/riya-prompt.md` (ElevenLabs) and `voice-agent/riya-sarvam-prompt.md` (Sarvam). After changing the Sarvam agent, commit a version in Sarvam, raise `SARVAM_APP_VERSION`, then redeploy.

Safeguards: consent confirmation on every add/upload, calls only 9 am–9 pm IST, people who ask not to be called are marked "Do not call" automatically, and calling is off per firm until the platform admin switches it on (with a monthly cap) on the firm's page. Tables: `call_contacts`, `calls` (`supabase/ai_calls.sql`).

**Automatic callback for website enquiries.** A firm can switch on "Call new website enquiries automatically" on its AI calls page. A database trigger (`supabase/auto_call.sql`) then queues a call about a minute after each enquiry (enquiries at night wait until 9 am IST). Supabase pg_cron pings `/api/voice/process-queue` every minute while there is work (`supabase/auto_call_cron.sql`), which places due calls through the same safeguards as the Call button and saves finished calls' results. Each number is auto-called at most once a day, only one call per firm runs at a time, technical failures are retried twice 10 minutes apart, and anything not placed within 24 hours is dropped. Needs `CRON_SECRET` in the site env and in the cron SQL.

## Lead finder (platform admin → Leads)

Finds brokerages on Google (Places API Text Search) area by area, scores them as prospects for a website (no website +3, WhatsApp-able mobile +2, 20+ reviews +1, rating ≥ 4 +1), and tracks outreach: status, follow-up date, notes, Call/WhatsApp buttons that log contact, a fill-in WhatsApp message, and **Create demo website** (a demo firm built from the lead's details). Tables: `leads`, `lead_activities`, `outreach_template`, `places_usage` (`supabase/leads.sql`, platform admin only).

Needs `GOOGLE_PLACES_API_KEY` (server-only). Searching stops once `LEADS_MONTHLY_REQUEST_LIMIT` Google requests (default 900) are used in a month, to stay inside Google's free allowance. Google's terms allow keeping place IDs long-term; other details are meant to be refreshed, which re-running a search does.

## Pages

**Each firm's website** (`/<slug>/…`): home, properties with filters, property detail (gallery, map, EMI calculator, enquiry form, WhatsApp), about, services, contact.

**Admin** (`/login`, then `/admin/…`): listings, add/edit listing, make reel, enquiries, AI calls (`/admin/calls`), WhatsApp write-up (`/admin/writeup`), firm profile; for the platform admin also firms (`/admin/firms`), logins (`/admin/users`), the lead finder (`/admin/leads`) and towers and areas (`/admin/knowledge`).

**Voice API** (`/api/voice/…`, used by the voice agents and the scheduler, never by visitors): `listings`, `places`, `process-queue`, `sarvam-webhook`.

## Setting up from scratch

You need Node.js 18.18+, a Supabase project (region Mumbai, ap-south-1) and a Netlify account.

1. **Database.** In Supabase, open **SQL Editor** and run, in order: `supabase/schema.sql` (then optionally `supabase/seed.sql` for 5 sample listings: it only works before the next file), `supabase/multi_tenant.sql`, `supabase/leads.sql`, `supabase/ai_calls.sql`, `supabase/auto_call.sql`, `supabase/inventory.sql`, `supabase/scale.sql` (indexes and spam protection), `supabase/sarvam.sql`, then `features/knowledge-base/schema.sql` and its `seed.sql`. Last, run `supabase/auto_call_cron.sql` after putting your site address and `CRON_SECRET` into it (don't commit the secret). Never run `multi_tenant.sql` again on a live database: it would reopen the rules that `inventory.sql` and `scale.sql` closed.
2. **Lock sign-ups.** **Authentication → Sign In / Providers → Email**: turn off "Allow new users to sign up".
3. **Settings.** Copy `.env.example` to `.env.local` and fill in the Supabase URL, anon key and secret key.
4. **Your admin login.** `npm install`, then `npm run set-admin -- you@example.com 'YourPassword'`.
5. **Run locally.** `npm run dev`, then open http://localhost:3000 and http://localhost:3000/login.
6. **Deploy.** Push to GitHub and import the repository in Netlify. Add every variable from `.env.example` that you use under **Environment variables**. Every push to `main` redeploys; after changing a variable, trigger a deploy (Netlify reads them only at deploy time).
7. **Check it.** `npm run smoke` checks the live site: every firm's pages, login and admin protection, the voice API's keys and the database's enquiry protection. It reads only, and takes the site address as an argument (`npm run smoke -- https://your.site`).

Locked out of every admin login? Run `npm run set-admin -- <email> '<new password>'` in this folder. It creates or resets a platform admin.

## Running at scale

What keeps the platform fast, cheap and safe as firms and visitors grow:

- **Cached firm websites.** Home, property, about, services and contact pages are cached and rebuilt at most every 5 minutes, or straight after the firm changes a listing or its profile (`app/actions/site.js`). Visitors get a ready page instead of a database round trip each.
- **Paginated listings.** The public Properties page shows 24 at a time.
- **Spam-proof enquiries.** Enquiries are saved only by the server (`app/actions/enquiry.js`), never directly from the browser, because each one can queue an automatic AI call:
  - a hidden trap field and a minimum fill time stop simple bots;
  - limits: 5 enquiries per visitor per hour and 40 per firm per hour;
  - the same number twice within 10 minutes is saved once.
- **Indexes** for the busiest queries, and counts done in the database (`supabase/scale.sql`).
- **Security headers** on every page (`next.config.mjs`).
- **Automatic calls** are claimed one at a time, so no number is called twice; at most 5 calls start per minute, one per firm at a time (`app/api/voice/process-queue/route.js`).

Before many paying firms are live:

| Service | Do this | Why |
| --- | --- | --- |
| Supabase | Pro plan; turn on point-in-time recovery | No pausing, daily backups, more storage for photos |
| Netlify | Paid plan with auto-recharge | The free plan stops deploying when credits run out |
| Twilio | Upgrade from the trial | The trial calls verified numbers only |
| ElevenLabs | A plan with enough concurrent calls | Each firm's calls run one at a time, but firms run in parallel |
| Sarvam | An Indian number for the Sarvam connection | The pilot dials from the US Twilio trial number |
| Monitoring | An error tracker (e.g. Sentry) and an uptime check on the home page | To hear about failures before clients do |

## Free tier limits

Supabase free: 500 MB database, 1 GB photo storage, shared by all firms. A free project pauses after 7 days without visits; the Pro plan removes that and adds daily backups, which is recommended once paying clients are live.

## Project structure

```
app/
  [firm]/              a firm's public website (/<slug>/…)
  admin/               admin panel (protected); each screen's server actions sit beside it in actions.js
    [id]/edit, [id]/reel   edit a listing, make its reel
    calls/             AI calls: contacts, results, queue
    enquiries/         website enquiries
    writeup/           WhatsApp write-up (features/whatsapp-writeup)
    knowledge/         towers and areas (features/knowledge-base)
    firms/ users/      platform admin: firms, logins
    leads/             platform admin: lead finder
    profile/           a firm's own details
  api/voice/           listings, places, process-queue, sarvam-webhook
  actions/             saving enquiries; refreshing a firm's cached pages
  login/               sign-in
components/            shared UI; components/admin/ for the admin panel (calls/, leads/, reel/)
features/              newer features kept whole (see features/README.md)
lib/site.js            the firm "site" object (toSite), links (href), constants
lib/firm.js            loads a firm by its web address
lib/auth.js            who is signed in, which firm they work on, requirePlatformAdmin, isUuid
lib/voice.js           placing calls and their safeguards; ElevenLabs
lib/sarvam.js          the Sarvam calling path and its webhook report
lib/secret.js          constant-time comparison of secrets (voice key, cron secret)
lib/spoken-amount.js   prices and sizes as spoken English words
lib/places.js, leads.js  Google Places search; lead scoring and messages
lib/reel.js            drawing reel frames in the browser
lib/supabase/          database clients (browser, server, public, secret-key)
middleware.js          sends logged-out visitors from /admin to /login
scripts/set-admin.mjs  create or reset a platform admin login
scripts/smoke.mjs      live health check (npm run smoke)
supabase/              every SQL file, run in the order under "Setting up from scratch"
voice-agent/           Riya's prompts (ElevenLabs, Sarvam)
```
