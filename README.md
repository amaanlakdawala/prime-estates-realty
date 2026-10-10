# Prime Estates Realty — real estate website

A complete website for a Pune real estate brokerage, with a private admin dashboard where employees add, edit, hide and delete property listings.

**Built with:** Next.js 15 (website), Supabase (database, employee logins, photo storage), Tailwind CSS (styling). Hosted on Vercel.

## What's included

**Public pages:** Home (`/`), Properties with filters (`/properties`), Property detail with gallery, map, EMI calculator, enquiry form and WhatsApp (`/properties/[id]`), About (`/about`), Services (`/services`), Contact (`/contact`).

**Employee-only pages:** Sign in (`/login`), Listings table with search, filters, mark sold/rented, relist and delete (`/admin`), Add listing (`/admin/new`), Edit listing (`/admin/[id]/edit`), Enquiries from website forms (`/admin/enquiries`).

Security is enforced in the database itself (Row Level Security), not only in the pages: visitors can only read available listings and send enquiries; only signed-in employees can change anything.

---

## Setup (about 20 minutes)

You need: a free [GitHub](https://github.com) account, a free [Supabase](https://supabase.com) account, a free [Vercel](https://vercel.com) account, and [Node.js 18+](https://nodejs.org) on your computer to test locally.

### 1. Create the Supabase project
1. In Supabase, click **New project**. Pick the **Mumbai (ap-south-1)** region so the site is fast in India. Save the database password somewhere safe.
2. When it's ready, open **SQL Editor → New query**, paste everything from `supabase/schema.sql`, and click **Run**. This creates the tables, security rules and the photo storage bucket.
3. (Optional) Run `supabase/seed.sql` the same way to add 5 sample listings for testing.

### 2. Lock down sign-ups and create employee accounts
1. Go to **Authentication → Sign In / Providers**. Under Email, turn **off** "Allow new users to sign up". This is important: only accounts you create can log in.
2. Go to **Authentication → Users → Add user → Create new user**. Enter the employee's email and a password, tick **Auto Confirm User**, and save. Repeat for each employee.
3. To remove an employee's access later, delete their user here.

### 3. Run it on your computer
1. Copy `.env.example` to `.env.local`.
2. In Supabase, open **Project Settings → API** and copy the **Project URL** and the **anon public** key into `.env.local`.
3. In a terminal in this folder:
   ```bash
   npm install
   npm run dev
   ```
4. Open http://localhost:3000 for the website and http://localhost:3000/login for the admin.

### 4. Put in the firm's real details
The firm's name, city, phone/WhatsApp, email, address, office hours, MahaRERA number, founding year, localities and logo are **environment variables** (`NEXT_PUBLIC_FIRM_…`), so one codebase serves every client. Set them in `.env.local` locally and in Netlify for each live site. **`CLIENT_SETUP.md`** has the full list and the steps for setting up a new firm.

Sample testimonials and a sample team appear only when `NEXT_PUBLIC_DEMO_CONTENT=true` (demo sites). MahaRERA mentions appear only once `NEXT_PUBLIC_FIRM_RERA_NO` is set.

For a photo behind the home page headline, add an image named **`hero.jpg`** to the `public/` folder (a wide skyline or building photo, ideally around 2000 px wide and under 400 KB).

### 5. Deploy to Vercel
1. Create a new **private** repository on GitHub and upload this folder (without `node_modules` or `.env.local`):
   ```bash
   git init
   git add .
   git commit -m "First version"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/vr-pandey-ventures.git
   git push -u origin main
   ```
2. In Vercel, click **Add New → Project**, import the repository.
3. Before clicking Deploy, open **Environment Variables** and add both values from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**. In about a minute you get a live link like `vr-pandey-ventures.vercel.app`.

From now on, every `git push` to `main` updates the live site automatically.

### 6. Connect your own domain
1. Buy the domain (e.g. from GoDaddy, Hostinger or Namecheap).
2. In Vercel: **Project → Settings → Domains → Add** and type your domain.
3. Vercel shows one or two DNS records. Add them in your domain provider's DNS settings. HTTPS is set up automatically, usually within an hour.
4. In Supabase, go to **Authentication → URL Configuration** and set **Site URL** to your domain.

---

## How employees use the admin

1. Go to `yourdomain.com/login` and sign in.
2. **Add listing:** fill in the form, add photos (the first is the cover; use *Make cover* to change it), and save. It appears on the website immediately.
3. **Edit:** select *Edit* on any row, change anything, *Save changes*.
4. **Mark sold / Mark rented:** hides the listing from the website but keeps it in the dashboard. Use *Relist* to show it again.
5. **Delete:** removes the listing and its photos permanently (asks for confirmation first).
6. **Enquiries:** every form sent from the website appears here with call and WhatsApp buttons.

## Free tier limits

Supabase free: 500 MB database, 1 GB photo storage (roughly 300–500 listings with ~8 compressed photos each). A free project pauses after 7 days without any visits; the Pro plan ($25/month) removes that and adds daily backups, which is recommended once the site is live.

Vercel free (Hobby) is fine to start; Vercel's terms ask commercial sites to use the Pro plan ($20/month), so upgrade when the firm starts using it for business.

## Project structure

```
app/
  (site)/            public pages with header + footer
    page.js          home
    properties/      listings + property detail
    about/ services/ contact/
  login/             employee sign-in
  admin/             employee dashboard (protected)
components/          shared UI (cards, forms, gallery, EMI calculator)
components/admin/    listing form, listings table, dialogs
lib/site.js          firm details — edit this first
lib/supabase/        database connection helpers
middleware.js        redirects logged-out users away from /admin
supabase/schema.sql  database tables and security rules
supabase/seed.sql    optional sample listings
```
