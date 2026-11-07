# Listing checks: Riya calls the owners

Out-of-date listings are a daily headache: the flat was rented last week, the owner raised the price, and the
client hears about it only at the site visit. With this add-on Riya calls the owner of every available listing
every 7 days (per firm: 3–60), asks whether it is still available and at what price, and:

- **gone** (rented, sold, owner keeping it) → the listing is marked Rented or Sold, off the website and AI search
- **new price** → the listing's price is updated (only between 0.3× and 3× the old price; otherwise flagged)
- **same** → nothing changes; the check is logged
- **"don't call me"** → checks for that listing pause
- anything else the owner says (call back, a new property to give) → noted on the check for the team

Switched on per firm by the platform admin: **Firms → firm → Add-on services → Listing checks**, with a monthly
call limit (default 200). The owner's name and mobile go on each listing (**Edit listing → Owner**, private:
`listing_owners`, never readable by the public). The firm's **Listing checks** page shows what is due, a
**Check now** button, and every call with its result and conversation.

## Rules (`checks.js`, `RULES`)

| Rule | Value |
| --- | --- |
| Days and hours | Monday to Saturday, 10 am to 7 pm IST |
| Per firm | one call at a time; at most the monthly limit |
| Per listing | every N days after an answered check; not answered → next day, up to 3 times, then N days |
| Never called | listings not Available, no valid Indian mobile, checks paused |

Calls are placed by the every-minute schedule that already runs enquiry calls (`/api/voice/process-queue`).

## Setting it up

1. Run `supabase/14_services.sql`.
2. Sarvam agent **Riya listing check**: clone "Riya sales caller" (Kavya voice, speech settings), replace the
   prompt with `prompt.md` (below the line) and the opening line from its header. Call inputs: `firm_name`,
   `owner_greeting`, `property`, `deal`, `price_words`, `today`. Post-call fields: `still_available` (yes / no /
   unsure), `new_price` (number, rupees; monthly rent for rentals), `available_from`, `owner_note`,
   `callback_time`, `do_not_call` (boolean). Commit.
3. Sarvam campaign **Riya listing checks** with that agent and version, the phone number, Mon–Sat 10–7, no
   retries, webhook `https://nexorautomate.netlify.app/api/listing-checks/webhook?key=<VOICE_TOOL_SECRET>`.
4. Netlify env `LISTING_CHECK_SARVAM_CAMPAIGN_ID=<campaign id>`, redeploy. Without it nothing is called.

Cost: about one minute per call, about ₹5–8 on Sarvam.

## Files

| File | What |
| --- | --- |
| `prompt.md` | Riya's prompt for owner calls (source of truth for the Sarvam agent) |
| `checks.js` | Rules, what is due, placing a call, applying the result |
| `webhook.js` | Sarvam's end-of-call report → `app/api/listing-checks/webhook/route.js` |
| `actions.js` | Check now |
| `admin/ListingChecksPage.js` | The firm's page → `app/admin/listing-checks/page.js` |
