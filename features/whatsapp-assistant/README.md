# WhatsApp assistant: AI replies to clients on each firm's WhatsApp

When a client messages a firm's WhatsApp Business number, an AI assistant replies within seconds, day or
night, in the client's language (English, Hindi or Hinglish). It is the text version of Riya, the AI calling
assistant, with the same rules.

- **Answers questions** about the firm: office, timings, areas, services.
- **Understands the requirement** (buy or rent, area or project, BHK, budget, timeline), one question at a
  time, and **searches the firm's whole inventory**, including private listings, the same way the calling
  assistant does.
- **Suggests at most two listings** with photo, price and size. It never says "we don't have it" and never
  invents a price. When nothing fits, it says the consultant will reach out with suitable options.
- **Books site visits** (day only; the consultant confirms the time) and **hands over to a person** when
  the client asks for one, is upset, or the question needs a human (negotiation, legal, payments).
- **Says it is an assistant** when asked, never claims to be human.

Firms see every conversation in their admin panel, with the requirement it picked up, and can **take over**
any chat (the AI stops replying in it) or switch the assistant off.

## How it works

```
Client ──WhatsApp──▶ Meta ──webhook──▶ /api/whatsapp/webhook ──▶ engine
                                        (signature checked)        │
                                                                   ├─ which firm? (by phone number ID)
                                                                   ├─ human took over / assistant off? → only log
                                                                   ├─ AI reply (firm details + listings search
                                                                   │            + this conversation's history)
                                                                   └─ hand-over? → alert the firm (email)
                                                                          │
                                   Meta Cloud API ◀── reply ──────────────┘   log ▶ whatsapp_messages
```

Replies are always inside WhatsApp's **24-hour customer service window** (the client wrote first), so the
assistant uses ordinary text messages, which Meta does not charge for. It never starts conversations.

## Folder layout (to come)

| Path | What it is |
| --- | --- |
| `README.md` | This file |
| `schema.sql` | Numbers, conversations, messages, per-firm settings |
| `webhook.js` | Reads Meta's incoming-message payloads |
| `engine.js` | One incoming message end to end: route, reply, log, hand over |
| `admin/` | Conversations list, a conversation with "Take over", settings |

Uses `features/shared/meta` (Meta client) and `features/shared/assistant` (AI replies + listings search).
Routes in `app/`: `app/api/whatsapp/webhook/route.js`, `app/admin/whatsapp/page.js`.

## Data

| Table | Holds |
| --- | --- |
| `whatsapp_numbers` | Each firm's WhatsApp Business phone number ID and display number (token server-only) |
| `whatsapp_conversations` | One per client per firm: status (AI / human / closed), the requirement picked up |
| `whatsapp_messages` | Every message in and out, with who sent it (client, AI, firm) |
| `whatsapp_settings` | Per firm: assistant on/off, hours, hand-over contact, greeting |

## What's needed before it can go live

1. **The same Meta developer app** as social replies, with the WhatsApp product added
   (use case "Connect with customers through WhatsApp"), and a **business portfolio**.
2. **A WhatsApp Business Account and a phone number per firm.** A number already on the normal WhatsApp app
   can't be used by the API at the same time; firms either use a new number or connect their WhatsApp
   Business app number through Meta's Embedded Signup. Meta provides a free **test number** for building.
3. **A permanent token** from a system user (Business Settings) with `whatsapp_business_messaging` and
   `whatsapp_business_management`.
4. **Business Verification** (for higher message limits and for onboarding client firms), and **Embedded
   Signup** so firms can connect their own number from the admin panel.
5. **Billing:** replies to clients who wrote first are free; any message the business starts outside the
   24-hour window must be an approved template and is charged per message (rates in INR for India;
   Indian WhatsApp accounts must be billed in INR by 31 Dec 2026). This feature only replies, so it stays free.
6. **An AI key** (`ANTHROPIC_API_KEY`), shared with social replies.

## Build plan

1. Webhook, conversation log and AI replies, tested with sample payloads and then on Meta's test number.
2. Hand-over to a human, "Take over" in the admin panel, firm alerts by email.
3. Embedded Signup so each firm connects its own number; Business Verification.

Platform references checked October 2026: WhatsApp Cloud API get-started (Graph API v23.0), WhatsApp
pricing (per-message since 1 July 2025; free inside the customer service window).
