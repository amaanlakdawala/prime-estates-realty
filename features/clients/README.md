# Clients: requirements, automatic matching, pipeline, dashboard

Every firm gets one place for its buyers and tenants, and the listings that fit each of them.

## What the firm sees

- **Dashboard** (`/admin/dashboard`, the page after login): new enquiries this week, new matches, follow-ups
  due, site visits, AI calls this month; the pipeline by stage; new matches to share; follow-ups due; newest clients.
- **Clients** (`/admin/clients`): tabs per stage, follow-ups due and all open matches; search; **Add client** with
  "what they want" in plain words.
- **A client** (`/admin/clients/<id>`): matching listings, the requirement as fields (editable), stage buttons
  (New → Contacted → Site visit → Negotiation → Won / Lost), next follow-up date, notes and the full history.
- **A listing's edit page**: "Clients who want this".
- Every match has **WhatsApp** (opens WhatsApp with a ready Hinglish message and the listing link), **Riya calls**
  (an AI call about that listing, offering a site visit; when AI calling is on), **Interested** and **Dismiss**.

## How clients and requirements are filled

`sync.js` runs whenever the dashboard or the clients page opens (no schedule needed):

| Source | Becomes | Requirement from |
| --- | --- | --- |
| Website forms, AI chatbot, WhatsApp assistant, portal leads (all are enquiries) | a client (by mobile number) | the message text, and the listing they asked about |
| Riya's finished calls | the same client, stage Contacted (Site visit when booked), follow-up tomorrow | the call's fields: deal, area, project, BHK, budget, timeline |
| Added by the team | a client | "what they want" |

Each enquiry and call is taken in once (`client_activities.ref`). Stages only move forward automatically.
`requirement.js` reads text with plain rules, no AI: rent/buy, type, BHK (or a range), budgets ("1.5 cr", "85
lakh", "60k", "25000"), and areas from the Mumbai areas list (with their other spellings).

## Matching (`match.js`)

A listing matches when it is available and: same deal; same type (flat and villa both count as a home); BHK in
the range (one more or less still shows, scored lower); price within budget (up to 10% over, scored lower); and
in an asked-for area, a region that contains it ("Western suburbs"), or an area within 8 km (from the knowledge
base's map positions). Score out of 100: area 40, budget 25, BHK 20, type 10, deal 5; unknown parts count half.
Shown from 55. New fits appear as "new"; fits that stop holding are removed unless the team already acted.

## Setup

Run `supabase/15_clients.sql`. Until then the dashboard says the system is being set up and the rest of the
admin works as before.

| File | What |
| --- | --- |
| `requirement.js` | Reading requirements from text, calls and listings; describing them |
| `match.js` | Scoring a listing against a requirement |
| `sync.js` | Taking in enquiries and calls; recomputing matches |
| `format.js` | Stages, source names, the WhatsApp share message |
| `actions.js` | Add client, stage and follow-up, requirement, notes, share, Riya calls |
| `admin/` | Dashboard, Clients, Client, MatchCard, forms, Clients who want this |
