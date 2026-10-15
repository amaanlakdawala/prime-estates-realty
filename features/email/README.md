# Email: alerts to firms and automatic emails to clients

Two kinds of email, sent by the platform on behalf of each firm.

## 1. Alerts to the firm

Sent to the firm's email address (Firm profile), and to any extra addresses the firm adds.

| Alert | When | What it contains |
| --- | --- | --- |
| New enquiry | As soon as a website form is sent | Name, phone, message, the property asked about, a WhatsApp / call button |
| AI call finished | When a call's result is saved | Summary, requirement (area, BHK, budget, site visit), link to the full transcript |
| Needs a person | WhatsApp assistant hands over, or a comment is held | The conversation and why it was handed over |
| Daily or weekly digest | Every morning or Monday, if switched on | Enquiries, calls, site visits booked, listings added |

## 2. Automatic emails to clients

Only to people who gave their email to the firm (enquiry form, or added by the firm with consent).
Each is sent in the firm's name, with **Reply-To** set to the firm's email, so replies go to the firm.

| Email | When | What it contains |
| --- | --- | --- |
| Enquiry received | Right after a website enquiry with an email | Thank you, the property they asked about, up to 3 similar listings, firm contact |
| After the AI call | When a call with a known email ends | What they're looking for, matching listings, "Book a site visit" |
| Site visit confirmed | When the firm confirms a visit | Date, address, map link, the consultant's number |

Every email has the firm's name, address and phone, and client emails have a one-click **unsubscribe**.
Firms switch each email on or off and can edit the wording.

## How it works

Emails are queued in the database (`email_outbox`) by the events above, and sent by the existing
every-minute scheduler through an email provider. Failed sends are retried, and every send is logged,
so firms can see what went out.

## Folder layout (to come)

| Path | What it is |
| --- | --- |
| `README.md` | This file |
| `schema.sql` | Outbox, send log, per-firm email settings, unsubscribes |
| `templates/` | The emails, one file each, in the firm's name and colours |
| `send.js` | Sends queued emails through the provider, retries, logs |
| `admin/` | Settings: which emails are on, alert addresses, wording |

## What's needed before it can go live

1. **An email provider account.** Recommended: **Resend** (simple, has a free tier; check its current limits).
   Amazon SES is cheaper at scale.
2. **A domain you own** (for example `primeestatesrealty.in`), to send from (e.g. `alerts@…`).
   Providers require proving you own the sending domain with a few DNS records (SPF, DKIM), which also keeps
   emails out of spam. The current `netlify.app` address can't be used for this. The same domain can later
   give each firm its own web address (`firmname.yourdomain.in`).
3. The provider's API key in the environment (`RESEND_API_KEY` or SES credentials).

## Build plan

1. Outbox, sender, and the firm alerts (new enquiry, AI call finished).
2. Client emails (enquiry received with matching listings, after the call, site visit confirmed) with
   unsubscribe.
3. Settings page and digest.
