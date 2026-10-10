# Setting up a new client firm

Every firm runs on this same GitHub repository. Each one gets its own Supabase project (its own listings, enquiries and logins) and its own Netlify project. Its name, phone, city and areas come from Netlify environment variables, so you never edit code for a client.

Because every client site builds from the same `main` branch, one `git push` updates all of them. Test locally before pushing.

Time per client: about 30 minutes.

## 1. Their database (Supabase)

1. Go to [supabase.com](https://supabase.com) → **New project**. Name it after the firm, pick region **Mumbai (ap-south-1)**, and save the database password.
2. **SQL Editor → New query**: paste `supabase/schema.sql` and **Run**.
3. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up".
4. **Authentication → Users → Add user → Create new user**: add the firm owner's email and a password, and tick **Auto Confirm User**.
5. **SQL Editor**: run `supabase/make_admin.sql` with the owner's email in it. They become admin and can add their own staff from the **Team** page.
6. **Project Settings → API Keys**: copy the Project URL, the anon key and the secret key for step 2.

## 2. Their website (Netlify)

1. Netlify → **Add new project → Import an existing project → GitHub** → choose `prime-estates-realty`.
2. Before deploying, open **Environment variables** and add:

| Variable | Example | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abcd1234.supabase.co` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key from step 1 | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key from step 1 | Yes (for the Team page) |
| `NEXT_PUBLIC_FIRM_NAME` | `Sea Breeze Realtors` | Yes |
| `NEXT_PUBLIC_FIRM_CITY` | `Mumbai` | Yes |
| `NEXT_PUBLIC_FIRM_PHONE` | `+91 98200 12345` (also used for WhatsApp) | Yes |
| `NEXT_PUBLIC_FIRM_LOCALITIES` | `Andheri West, Bandra West, Powai, Juhu` | Yes |
| `NEXT_PUBLIC_FIRM_ADDRESS` | `Shop 3, Lokhandwala Complex, Andheri West, Mumbai 400053` | Yes |
| `NEXT_PUBLIC_FIRM_EMAIL` | `hello@seabreezerealtors.in` | Yes |
| `NEXT_PUBLIC_FIRM_FOUNDED_YEAR` | `2015` | Yes (shown as "since 2015") |
| `NEXT_PUBLIC_FIRM_RERA_NO` | their MahaRERA agent number | Recommended; all MahaRERA mentions stay hidden without it |
| `NEXT_PUBLIC_FIRM_HOURS` | `Monday to Saturday, 10 am to 7 pm` | Optional |
| `NEXT_PUBLIC_FIRM_WHATSAPP` | only if WhatsApp is a different number | Optional |
| `NEXT_PUBLIC_FIRM_LOGO_URL` | `https://…/logo.png` | Optional |

3. **Deploy.** Their site is live at `something.netlify.app` in a few minutes.
4. Changed a variable later? Go to **Deploys → Trigger deploy → Clear cache and deploy site**. These values are built into the pages, so they only update on a new deploy.

## 3. Their domain (optional)

Netlify → **Domain management → Add a domain**, then add the DNS records it shows at their domain provider. HTTPS is set up automatically.

## 4. Before it goes live

- [ ] Every "Yes" variable above is set with the firm's **real** details (name, phone, address, founding year).
- [ ] `NEXT_PUBLIC_DEMO_CONTENT` is **not** set on their site. It is only for your demo sites. On a live site, the sample testimonials and sample team must never appear as if real. To show real testimonials or the real team, that is a code change: ask before doing it.
- [ ] Their first listings are added, with real photos.
- [ ] The owner can sign in at `/login` and sees **Team** in the menu.
- [ ] A test enquiry from the website appears under **Enquiries**.
- [ ] Send the owner their login, and keep a copy of their keys somewhere safe (not in this repository).

## Demo sites for pitching

The same steps, with your own Supabase project and `NEXT_PUBLIC_DEMO_CONTENT=true`, give a full-looking demo with any firm's name and city. Add 3–5 of their real listings before the meeting.
