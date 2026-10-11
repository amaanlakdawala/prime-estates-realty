# Prime Estates Realty — websites for real estate brokerages

One codebase that gives each client brokerage its own property website and a private admin panel, all from a single deployment and database.

**Built with:** Next.js 15, Supabase (database, logins, photo storage), Tailwind CSS. Hosted on Netlify.

## How it fits together

- **Firms.** Each client is a row in the `firms` table: name, web address (slug), phone, city, areas, MahaRERA number, logo. Its website is at `/<slug>`, e.g. `/prime-estates`. The site root (`/`) shows your demo firm.
- **Platform admin (you).** A login with `app_metadata.role = 'admin'`. You see **Firms** and **Logins**, create firms and their logins, set passwords, pause firms, and can manage any firm's listings.
- **Firm logins.** `app_metadata.role = 'firm'`, linked to one firm in `firm_users`. A firm login sees only its firm's **Listings**, **Add listing**, **Enquiries** and **Firm profile**.
- **Isolation in the database.** Row Level Security (`supabase/multi_tenant.sql`) stops a firm login from reading or changing another firm's listings, enquiries or photos, whatever the website code does. Photos live in a storage folder per firm.

**`CLIENT_SETUP.md`** covers adding a client and day-to-day tasks.

## Listing reels (Listings → Make reel)

Every listing has a **Make reel** button. It turns the listing's photos into a 1080×1920 Instagram reel with the headline, location, price, one fact per photo (BHK and size, amenities, floor) and a closing card with the firm's phone number and website, plus the MahaRERA numbers when filled in. Firms pick the photos and their order, the corner label (Just listed, Price drop, Sold…), speed and style (full screen or framed), preview it live, then download the MP4 or share it from a phone. A ready-to-paste caption with five hashtags is generated alongside. The video is encoded in the browser with WebCodecs ([Mediabunny](https://mediabunny.dev)), so it costs nothing per reel and nothing is uploaded; it works in Chrome, Edge and Safari. Reels have no sound, so firms add a trending song in Instagram when posting. Drawing code: `lib/reel.js`; screen: `components/admin/reel/ReelMaker.js`. Photos linked from other websites only work if that site allows it (CORS); uploaded photos and Unsplash always do.

## AI calls (firm admin → AI calls)

Riya, an ElevenLabs voice agent, phones a firm's clients over Twilio in Hindi, English or Hinglish. Firms add clients by hand, upload a CSV (phone plus optional name, why calling, looking for), or press **AI call** on a website enquiry. Calls run one at a time; after each call the summary, the extracted requirement (buy/rent, area, project, BHK, budget, timeline, site visit, callback time) and the transcript appear on the page. One agent serves all firms: firm and contact details are passed per call as dynamic variables (`lib/voice.js`), and the agent looks up that firm's listings through `/api/voice/listings`.

Safeguards: consent confirmation on every add/upload, calls only 9 am–9 pm IST, people who ask not to be called are marked "Do not call" automatically, and calling is off per firm until the platform admin switches it on (with a monthly cap) on the firm's page. Tables: `call_contacts`, `calls` (`supabase/ai_calls.sql`). Needs `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID_SIA`, `ELEVENLABS_AGENT_ID_SIMRAN`, `ELEVENLABS_PHONE_NUMBER_ID`.

**Automatic callback for website enquiries.** A firm can switch on "Call new website enquiries automatically" on its AI calls page. A database trigger (`supabase/auto_call.sql`) then queues a call about a minute after each enquiry (enquiries at night wait until 9 am IST). Supabase pg_cron pings `/api/voice/process-queue` every minute while there is work (`supabase/auto_call_cron.sql`), which places due calls through the same safeguards as the Call button and saves finished calls' results. Each number is auto-called at most once a day, only one call per firm runs at a time, technical failures are retried twice 10 minutes apart, and anything not placed within 24 hours is dropped. Needs `CRON_SECRET` in the site env and in the cron SQL.

## Lead finder (platform admin → Leads)

Finds brokerages on Google (Places API Text Search) area by area, scores them as prospects for a website (no website +3, WhatsApp-able mobile +2, 20+ reviews +1, rating ≥ 4 +1), and tracks outreach: status, follow-up date, notes, Call/WhatsApp buttons that log contact, a fill-in WhatsApp message, and **Create demo website** (a demo firm built from the lead's details). Tables: `leads`, `lead_activities`, `outreach_template`, `places_usage` (`supabase/leads.sql`, platform admin only).

Needs `GOOGLE_PLACES_API_KEY` (server-only). Searching stops once `LEADS_MONTHLY_REQUEST_LIMIT` Google requests (default 900) are used in a month, to stay inside Google's free allowance. Google's terms allow keeping place IDs long-term; other details are meant to be refreshed, which re-running a search does.

## Pages

**Each firm's website** (`/<slug>/…`): home, properties with filters, property detail (gallery, map, EMI calculator, enquiry form, WhatsApp), about, services, contact.

**Admin** (`/login`, then `/admin/…`): listings, add/edit listing, enquiries, firm profile; for the platform admin also firms (`/admin/firms`) and logins (`/admin/users`).

## Setting up from scratch

You need Node.js 18.18+, a Supabase project (region Mumbai, ap-south-1) and a Netlify account.

1. **Database.** In Supabase, open **SQL Editor** and run, in order: `supabase/schema.sql`, `supabase/multi_tenant.sql`, `supabase/leads.sql`, `supabase/ai_calls.sql`, then `supabase/auto_call.sql`. Last, run `supabase/auto_call_cron.sql` after putting your site address and `CRON_SECRET` into it (don't commit the secret). Optionally run `supabase/seed.sql` after the first for 5 sample listings.
2. **Lock sign-ups.** **Authentication → Sign In / Providers → Email**: turn off "Allow new users to sign up".
3. **Settings.** Copy `.env.example` to `.env.local` and fill in the Supabase URL, anon key and secret key.
4. **Your admin login.** `npm install`, then `npm run set-admin -- you@example.com 'YourPassword'`.
5. **Run locally.** `npm run dev`, then open http://localhost:3000 and http://localhost:3000/login.
6. **Deploy.** Push to GitHub and import the repository in Netlify. Add the three Supabase variables under **Environment variables**. Every push to `main` redeploys.

Locked out of every admin login? Run `npm run set-admin -- <email> '<new password>'` in this folder. It creates or resets a platform admin.

## Free tier limits

Supabase free: 500 MB database, 1 GB photo storage, shared by all firms. A free project pauses after 7 days without visits; the Pro plan removes that and adds daily backups, which is recommended once paying clients are live.

## Project structure

```
app/
  [firm]/              a firm's public website (/<slug>/…)
  admin/               admin panel (protected)
    firms/             platform admin: firms, firm logins
    users/             platform admin: all logins
    profile/           a firm's own details
  login/               sign-in
components/            shared UI; components/admin/ for the admin panel
lib/site.js            the firm "site" object (toSite), links (href), constants
lib/firm.js            loads a firm by its web address
lib/auth.js            who is signed in and which firm they work on
lib/supabase/          database clients (browser, server, public, secret-key)
middleware.js          sends logged-out visitors from /admin to /login
scripts/set-admin.mjs  create or reset a platform admin login
supabase/              SQL: schema.sql, multi_tenant.sql, seed.sql
```
