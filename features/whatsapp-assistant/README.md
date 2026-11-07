# WhatsApp assistant: AI replies to clients on each firm's WhatsApp

When a client messages a firm's WhatsApp Business number, Riya replies within seconds, day or night, in the
client's language (English, Hindi or Hinglish). It is the website chatbot's assistant (`lib/chat/assistant.js`)
in its WhatsApp form, on Google Gemini.

- **Understands the requirement** (buy or rent, area or project, BHK, budget, timeline), one question at a
  time, and **searches the firm's whole inventory**, including private listings, like the calling assistant.
- **Sends at most two listings** as photos with title, price, size and a link (links only for listings on the
  public website). It never says "we don't have it" and never invents a price.
- **Voice notes** are written out by Gemini and answered like text.
- **Passes interested clients on** as an enquiry (source `whatsapp`) on the number they write from, so the
  firm's automatic AI call follows if it is on. Site visits: the day only; the consultant confirms the time.
- **Hands over to a person** when the client asks for one, is upset, or needs the team (negotiation, legal,
  payments, listing their own property): the chat is marked "Needs you" and Riya stops replying in it.
- **Says it is an AI assistant** when asked.

Switched on per firm by the platform admin: **Firms → firm → Add-on services → WhatsApp AI assistant**. The firm's
**WhatsApp** page lists every chat; the team can **Take over** (Riya stays quiet), reply from the panel within
WhatsApp's 24-hour window, or **Let Riya reply again**.

## How it works

```
Client ──WhatsApp──▶ Meta ──webhook──▶ /api/whatsapp/webhook (webhook.js: signature checked)
                                              │
                         engine.js: which firm (by phone number ID) → log the message (once per Meta id)
                                              │
                   team took over / service off? → only logged
                                              │
           assistant (history of this chat + listings search) → reply text + listing photos (meta.js)
                                              │
                        enquiry saved / handed over → shown on the firm's WhatsApp page
```

Replies always answer a message the client just sent, inside WhatsApp's 24-hour customer service window, so
Meta does not charge for them. Riya never starts conversations. Several messages in a row get one answer.
Limits: 60 AI replies per chat and 1,500 per firm a day; past that the chat goes to the team.

## Setting it up

1. Run `supabase/14_services.sql`.
2. **Meta developer app** (developers.facebook.com → Create app → use case "Connect with customers through
   WhatsApp"), linked to a business portfolio. Business Verification is needed before serving client firms.
3. **Permanent token**: Business Settings → System users → add one, give it the WhatsApp account, generate a token
   with `whatsapp_business_messaging` and `whatsapp_business_management`.
4. Netlify env: `META_APP_SECRET` (App settings → Basic), `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN` (any
   random text), then redeploy.
5. In the app: WhatsApp → Configuration → Callback URL `https://nexorautomate.netlify.app/api/whatsapp/webhook`,
   Verify token = `WHATSAPP_VERIFY_TOKEN`, subscribe to **messages**.
6. Per firm: add its number in WhatsApp Manager (a number already on the WhatsApp app must be moved, or use a new
   one; Meta's free test number works for trying it), then on the firm's **WhatsApp** page enter the **phone
   number ID**. A number in the firm's own Meta business takes its own token, entered there.

## Files

| File | What |
| --- | --- |
| `meta.js` | Meta Cloud API: signature check, sending text and photos, read receipts, voice notes |
| `engine.js` | One webhook end to end: log, limits, AI reply, hand-over |
| `webhook.js` | Meta's webhook (GET check, POST messages) → `app/api/whatsapp/webhook/route.js` |
| `actions.js` | Connect a number, Take over, team replies |
| `admin/WhatsAppPage.js` | The firm's page → `app/admin/whatsapp/page.js` |

Data (`supabase/14_services.sql`): `whatsapp_numbers` (server only, holds tokens), `whatsapp_conversations`
(mode `ai`/`human`, hand-over reason, enquiry saved), `whatsapp_messages` (every message in and out, AI token use).
