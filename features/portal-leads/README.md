# Portal leads: instant callback

Brokers pay 99acres, MagicBricks, Housing.com and others for leads, and usually call back hours later, when the
buyer has already spoken to three other brokers. With this add-on the firm forwards its portal lead emails to
its own address; each lead becomes an enquiry and Riya calls them within a minute (the firm's normal automatic
enquiry call, `supabase/05_auto_call.sql`, with the reason "they enquired on 99acres a few minutes ago").

Switched on per firm by the platform admin: **Firms → firm → Add-on services → Portal leads**. The firm then sees
**Portal leads** in its menu, with its forwarding address, Gmail setup steps and every email received.

## How it works

```
Portal ──email──▶ firm's Gmail ──filter: forward──▶ abc123+<firm key>@inbound.postmarkapp.com
                                                     │ (inbound email service)
                                                     ▼
                              POST /api/portal-leads/inbound  (inbound.js: firm from the key)
                                                     │
                     parse.js: Gemini reads the email (simple reader if Gemini is down)
                                                     │
              leads.js: portal_emails row, duplicate check (24 h), enquiries row (source portal:99acres)
                                                     │
                     enquiry trigger → call_queue → /api/voice/process-queue → Riya calls
```

- Not a lead (newsletter, report, invoice): saved as "Not a lead" with the reason.
- Gmail's forwarding confirmation email: its link is shown at the top of the firm's page, so the firm can
  confirm forwarding without seeing the email.
- **Paste a lead** on the page does the same for a lead that came by SMS or WhatsApp.
- The firm key (`firms.portal_inbox_key`, 24 random hex characters) is made when the service is switched on.
  It is the only secret in the address, so keep it private.

## Setting it up (once, for the whole platform)

1. Run `supabase/14_services.sql`.
2. Create a free **Postmark** account (postmarkapp.com) → a server → **Default Inbound Stream**. It shows an
   inbound address like `abc123@inbound.postmarkapp.com`. Set its webhook URL to
   `https://nexorautomate.netlify.app/api/portal-leads/inbound`.
3. Netlify env: `PORTAL_INBOX_ADDRESS=abc123@inbound.postmarkapp.com`, then redeploy.
4. Per firm: switch the service on; the firm (or you) follows the Gmail steps on its Portal leads page.
   Riya only calls when the firm has AI calling and automatic enquiry calls on.

Other inbound services work too (CloudMailin JSON, or anything posting `{ to, from, subject, text, html }`).

## Files

| File | What |
| --- | --- |
| `parse.js` | Reads one email: the lead (name, mobile, requirement, portal), or why it isn't one |
| `leads.js` | Saves the email and the enquiry; HTML to text |
| `inbound.js` | The email webhook → `app/api/portal-leads/inbound/route.js`; the firm's forwarding address |
| `actions.js` | Paste a lead |
| `admin/PortalLeadsPage.js` | The firm's page → `app/admin/portal-leads/page.js` |
