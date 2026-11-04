# Database (Supabase)

Every SQL file of the platform lives here. Run them in Supabase → **SQL Editor → New query**: paste the whole
file, click **Run**. Each file is safe to run again unless it says otherwise below.

## Setup, in this order

| # | File | What it adds |
| --- | --- | --- |
| 01 | `01_base.sql` | Listings, enquiries, photos (the first website) |
| 02 | `02_multi_tenant.sql` | Firms: each firm sees only its own data. **New database only, never again on a live one** (it would reopen rules that 06 and 07 closed) |
| 03 | `03_leads.sql` | Lead finder: brokerages found on Google, your outreach |
| 04 | `04_ai_calls.sql` | AI calling: contacts and calls |
| 05 | `05_auto_call.sql` | Automatic call for each new website enquiry |
| 06 | `06_inventory.sql` | Private listings, firms without a public website |
| 07 | `07_scale.sql` | Indexes and spam protection |
| 08 | `08_sarvam.sql` | Sarvam as a second calling service |
| 09 | `09_chatbot.sql` | The website chatbot |
| 10 | `10_knowledge_base.sql` | Mumbai areas and towers Riya knows |
| 11 | `11_knowledge_base_seed.sql` | The starting list of areas and towers |
| 12 | `12_sales_caller.sql` | Riya's sales calls to your leads, and the automatic calling switch |

## Scheduled jobs (`cron/`), last

These need your site address and `CRON_SECRET` typed in. Don't commit a filled-in copy: save it as
`<name>.local.sql` next to the template (git ignores `*.local.sql`).

| File | What it does | Needs |
| --- | --- | --- |
| `cron/auto_call_cron.sql` | Every minute: places due enquiry calls, saves results | 05 |
| `cron/sales_caller_cron.sql` | Every 10 minutes, Mon–Sat in calling hours: places the next sales call | 12 |

## Extras (`extras/`), only when needed

| File | When |
| --- | --- |
| `extras/sample_listings.sql` | 5 sample listings for testing. Only works between 01 and 02 |
| `extras/make_admin.sql` | Make someone a platform admin (or use `npm run set-admin`) |
| `extras/add_listing_owner.sql` | Old databases only; 01 and 02 already include it |

## Later (`later/`), not run yet

| File | Feature |
| --- | --- |
| `later/social_replies.sql` | Automatic replies to Instagram and Facebook comments (planned) |

A new feature's SQL gets the next number (13, 14, ...) and a line in the table above.
