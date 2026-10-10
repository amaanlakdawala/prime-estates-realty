# Prime Estates Realty — websites for real estate brokerages

One codebase that gives each client brokerage its own property website and a private admin panel, all from a single deployment and database.

**Built with:** Next.js 15, Supabase (database, logins, photo storage), Tailwind CSS. Hosted on Netlify.

## How it fits together

- **Firms.** Each client is a row in the `firms` table: name, web address (slug), phone, city, areas, MahaRERA number, logo. Its website is at `/<slug>`, e.g. `/prime-estates`. The site root (`/`) shows your demo firm.
- **Platform admin (you).** A login with `app_metadata.role = 'admin'`. You see **Firms** and **Logins**, create firms and their logins, set passwords, pause firms, and can manage any firm's listings.
- **Firm logins.** `app_metadata.role = 'firm'`, linked to one firm in `firm_users`. A firm login sees only its firm's **Listings**, **Add listing**, **Enquiries** and **Firm profile**.
- **Isolation in the database.** Row Level Security (`supabase/multi_tenant.sql`) stops a firm login from reading or changing another firm's listings, enquiries or photos, whatever the website code does. Photos live in a storage folder per firm.

**`CLIENT_SETUP.md`** covers adding a client and day-to-day tasks.

## Pages

**Each firm's website** (`/<slug>/…`): home, properties with filters, property detail (gallery, map, EMI calculator, enquiry form, WhatsApp), about, services, contact.

**Admin** (`/login`, then `/admin/…`): listings, add/edit listing, enquiries, firm profile; for the platform admin also firms (`/admin/firms`) and logins (`/admin/users`).

## Setting up from scratch

You need Node.js 18.18+, a Supabase project (region Mumbai, ap-south-1) and a Netlify account.

1. **Database.** In Supabase, open **SQL Editor** and run, in order: `supabase/schema.sql`, then `supabase/multi_tenant.sql`. Optionally run `supabase/seed.sql` first for 5 sample listings.
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
