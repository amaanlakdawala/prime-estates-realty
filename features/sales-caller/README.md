# Sales caller

Riya calls your leads (brokerages from Leads) and pitches your services: their own website, reels and AI
calling. She says she is your AI assistant, finds out how they get enquiries today, and tries to book a
15-minute demo with you, or at least their OK to get the sample website and pricing on WhatsApp. The call
itself is the demo of the AI calling.

Platform admin only. Runs on Sarvam, as a separate agent from the property Riya.

## How it works

1. **Leads → open a lead → AI sales call → Call with AI.** The button is disabled, with the reason, when a
   rule below says no.
2. `actions.js` → `calls.js` `placeLeadCall`: checks the rules, saves a `sales_calls` row, and places the call
   through Sarvam's outbound API (`lib/sarvam.js`) with the lead's details as agent variables.
3. When the call ends, Sarvam posts the result to `/api/sales-calls/webhook` (`webhook.js`), which saves the
   transcript and what Riya learned, adds a line to the lead's history, and moves the lead on:
   - asked not to be called → **Do not contact** (never called or messaged again from the app)
   - interested or demo booked → **Interested**, follow-up tomorrow
   - asked for WhatsApp or a callback → follow-up tomorrow
4. **Leads → AI sales calls** lists every call with totals for 30 days (placed, answered, interested,
   demos, minutes).

After a call, you send the WhatsApp yourself (sample site + pricing PDF) from the lead's page, as now.

## Automatic calling (`auto.js`, `supabase/cron/sales_caller_cron.sql`)

**Leads → AI sales calls → Automatic calling.** Off until you switch it on. Choose which leads (default:
Contacted, meaning WhatsApp sent and no reply yet) and how many calls a day (1 to 30). Supabase pg_cron pings
`/api/sales-calls/run` every 10 minutes, Monday to Saturday in calling hours, only while it is on. Each run places at
most one call: the highest-score lead nothing blocks, never while another call is still going. A call Sarvam
never reports on is closed as failed after an hour. The page shows the next 10 leads in line and an estimated
Sarvam cost.

Setup: `supabase/12_sales_caller.sql` (adds `sales_caller_settings`), then `supabase/cron/sales_caller_cron.sql` with your site address and `CRON_SECRET`.

## Rules (in `calls.js`, `RULES`)

| Rule | Value |
| --- | --- |
| Days and hours | Monday to Saturday, 10 am to 7 pm IST |
| Calls in any 24 hours | 30 (`SALES_CALLS_PER_DAY`) |
| Per lead | at most 3 AI calls, at least 3 days apart |
| Never called | Do not contact, Won, Lost; no Indian mobile number |
| On the call | she says she is an AI in the first line; "don't call" ends the call and blocks the lead |

## Files

| File | What |
| --- | --- |
| `prompt.md` | Riya's sales prompt, the source of truth for the Sarvam agent |
| `calls.js` | Rules, placing a call, handling the result (server) |
| `format.js` | How a call reads in the panel and the history |
| `actions.js` | The Call with AI button's server action |
| `auto.js` | Automatic calling: settings, who is next, one run |
| `supabase/cron/sales_caller_cron.sql` | The 10-minute schedule in Supabase → `app/api/sales-calls/run/route.js` |
| `admin/AutoCallSettings.js` | The automatic calling switch |
| `webhook.js` | Sarvam's end-of-call report → `app/api/sales-calls/webhook/route.js` |
| `admin/SalesCallPanel.js` | The panel on a lead's page |
| `admin/SalesCallsPage.js` | Leads → AI sales calls → `app/admin/leads/calls/page.js` |
| `supabase/12_sales_caller.sql` | The `sales_calls` and `sales_caller_settings` tables |

## Setting it up

1. Run `supabase/12_sales_caller.sql` in Supabase → SQL Editor.
2. The Sarvam agent exists: **Riya sales caller**, `Riya-sales--cee39f44-8fd2` (created 25 Oct 2026, cloned
   from the property Riya for the Kavya voice and the tested speech settings; version 1 committed). It has:
   - prompt: `prompt.md` below the line; opening line in English (Sarvam generates the Hindi)
   - no tools except the platform's voicemail and language switch
   - call inputs: `firm_name`, `city`, `area`, `has_website`, `demo_ready`, `company_name` (Nexora), `owner_whatsapp`, `today`
   - post-call fields: `interested` (boolean), `demo_time`, `whatsapp_ok` (boolean), `callback_time`,
     `lead_sources`, `website_status`, `objection`, `do_not_call` (boolean)
   - success goal: a demo slot or WhatsApp OK; voicemail and silence messages that say Nexora will WhatsApp.
3. The code defaults to that agent and version 6. After each new commit in Sarvam, set
   `SALES_SARVAM_APP_VERSION` in Netlify (and `SALES_SARVAM_APP_ID` only if you make a different agent). It uses
   the same Sarvam key, phone line and `VOICE_TOOL_SECRET` as AI calling.
4. Deploy, then test on your own verified number first.

## Before calling real leads

- **Phone line.** On the Twilio trial line, Sarvam can only call verified numbers. Real leads need an Indian
  number in Sarvam (Voice Agents → Telephony; about ₹59 per 30 days).
- **TRAI rules.** Calls promoting a service count as commercial communication in India. Calling people who
  never contacted you from an ordinary 10-digit number can get the number blocked or disconnected, and
  numbers on the national Do Not Disturb list (NCPR) should not get promotional calls. Safest order: call
  leads who replied to your WhatsApp or asked for details first; for cold calling at scale, use a number
  registered for commercial calls (the 140 series, through a registered telemarketer or Sarvam) and check
  numbers against the DND list.
- **Cost.** About ₹15 for an answered 3-minute call on Sarvam with an Indian number (see the pricing notes).
