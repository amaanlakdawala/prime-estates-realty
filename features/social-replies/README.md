# Social replies: automatic replies to Instagram and Facebook comments

Each client firm connects its Instagram professional account and Facebook Page. When someone comments on
one of the firm's posts or reels, the platform replies within about a minute:

- **Keyword rules first.** The firm sets keywords such as DEMO, PRICE, LOCATION or SITE VISIT, each with
  a fixed public reply and, optionally, a private message (DM) to the commenter.
  Example: comment "price" → public reply "Sent you the details in DM 🙏" + DM with the price and a
  "Book a site visit" link.
- **AI for everything else.** A genuine question with no keyword gets a short AI-written reply in the
  commenter's language (English, Hindi or Hinglish). It uses the firm's details and its listings, and
  follows the same rules as the AI calling assistant: never "we don't have it", never invented prices,
  always an invitation to WhatsApp or call.
- **Ignored, never answered:** spam, abuse, emoji-only comments, the firm's own comments, and replies
  inside a thread the firm is already handling. Each is logged with the reason.

Firms see every comment, what was replied and why on a **Social replies** page in their admin panel,
and can switch automatic replies off at any time.

## How it works

```
Instagram / Facebook ──webhook──▶ /api/social/webhook ──▶ engine
                                   (signature checked)      │
                                                            ├─ which firm? (by Page / IG account id)
                                                            ├─ skip? (own comment, spam, duplicate, off)
                                                            ├─ keyword rule? ─▶ fixed reply + DM
                                                            └─ else AI reply (firm details + listings)
                                                                     │
                                          Meta Graph API ◀── reply ──┘   log ▶ social_comments
```

## Folder layout

| Path | What it is |
| --- | --- |
| `README.md` | This file: what the feature does, how it works, how to set it up |
| `schema.sql` | Database tables and security rules. Run once in Supabase |
| `config.js` | Limits and the Meta Graph API version, in one place (to come) |
| `meta.js` | Meta Graph API client: webhook signature check, public reply, private reply (to come) |
| `rules.js` | Keyword matching and the spam / skip filter (to come) |
| `ai.js` | AI-written replies (to come) |
| `engine.js` | Handles one comment end to end and logs the result (to come) |
| `admin/` | The firm's admin screens: connection, rules, settings, comment log (to come) |

Routes in `app/` (thin, no logic): `app/api/social/webhook/route.js` (Meta webhook) and
`app/admin/social/page.js` (admin page).

## Data

| Table | Holds | Who can read it |
| --- | --- | --- |
| `social_accounts` | Each firm's connected Facebook Page / Instagram account | The firm (no tokens) |
| `social_account_tokens` | Access tokens for those accounts | Server only |
| `social_settings` | Per firm: auto-reply on/off, AI replies on/off, hourly limit, sign-off | The firm |
| `social_rules` | Keyword rules: keyword, public reply, private message | The firm |
| `social_comments` | Every comment received and what was done with it | The firm |

## What's needed before it can go live

1. **A Meta developer app** (developers.facebook.com → My Apps → Create app, type "Business"), with the
   Instagram and Facebook Login for Business products. Its **App ID** and **App Secret** go in the
   environment as `META_APP_ID` and `META_APP_SECRET`, plus a `META_WEBHOOK_VERIFY_TOKEN` we choose.
2. **A test Facebook Page with a linked Instagram professional account** (your own), to build and test
   against.
3. **Permissions.** Replies on Instagram need `instagram_business_basic` + `instagram_business_manage_comments`
   (or, via Facebook Login, `instagram_basic` + `instagram_manage_comments` + `pages_read_engagement`).
   Replies on Facebook need `pages_manage_engagement`. Private replies (DMs) need `pages_messaging` /
   Instagram messaging permission. Meta allows **one** private reply per comment, within **7 days**.
4. **Meta App Review and Business Verification.** Without them ("Standard Access") the app only works on
   accounts that have a role on the app, which is enough for testing on your own accounts. Connecting client
   firms' accounts needs "Advanced Access", which Meta grants after App Review (screen recordings of the
   feature, a privacy policy URL) and Business Verification. Plan for 1-4 weeks.
5. **An AI key** for the AI-written replies (Anthropic API key, `ANTHROPIC_API_KEY`).

## Build plan

1. **Foundations:** database tables, webhook endpoint with signature check, comment log. Tested with sample
   webhook payloads, no Meta account needed.
2. **Replies on your own account:** keyword rules, public replies and DMs, then AI replies, on your test
   Page / Instagram under Standard Access.
3. **Admin page for firms:** connect accounts, edit rules, settings, comment log.
4. **App Review** with Meta, then switch on for client firms.

Platform references checked October 2026: Instagram comment moderation (Graph API v25.0),
Page comment replies (v26.0), Messenger private replies (one per comment, within 7 days).
