# WhatsApp write-up: property posts for WhatsApp groups

Brokers share properties in WhatsApp groups all day. This turns a property into a neat, consistent WhatsApp
post, with **the sender's own name and number under every property**, ready to copy or share to groups.

Admin panel → **WhatsApp write-up** (or **Write-up** on any listing).

## How team members use it

1. **Your contact details.** Name and mobile number, filled in from the person's login profile. Each team
   member has their own number, so enquiries reach whoever posted. "Save as my details" stores it on their
   login. A write-up can't be made without a number.
2. **Property details**, either:
   - **From my listings:** tick one or more available listings (private ones included). Instant, no AI.
   - **Paste a description:** paste any messy text (a forwarded message, notes). The AI pulls out the facts
     and removes the original phone numbers, links and agent names. It never adds a detail that isn't in the text.
3. **The message.** Every property in the same layout, each followed by the contact, separated by a divider.
   Edit it if needed, then **Copy message** or **Share on WhatsApp**, which opens WhatsApp to pick groups.

Options: emojis on/off, show price, add a short description, add a photos link (public listings only).

## Example

```
🏡 *3 BHK Flat for Sale*
📍 Lodha Park, Lower Parel, Mumbai

💰 *Price:* ₹8.5 Cr
📐 *Area:* 1,650 sq ft
✅ *Amenities:* Lift, Power backup, 24x7 security
🧾 MahaRERA: P51900012345

🔗 Photos & details: https://…/prime-estates/properties/…

📞 *Contact:* Rahul Sharma – +91 98200 12345
_Prime Estates Realty_
```

## Files

| Path | What it is |
| --- | --- |
| `format.js` | The one layout: listing → fields, fields + contact → WhatsApp text. Runs in the browser |
| `extract.js` | Server only. Pasted text → fields, with Claude (structured output, low effort) |
| `actions.js` | Server actions: tidy a pasted description, save the signed-in person's contact |
| `admin/WriteupMaker.js` | The screen |

Route in `app/` (thin): `app/admin/writeup/page.js`. Linked from the admin menu and each listing row.

The AI only extracts facts into fixed fields; `format.js` does all the formatting, so every write-up looks the
same whether it came from a listing or pasted text.

## Setup

- **From my listings** works with no setup.
- **Paste a description** needs `ANTHROPIC_API_KEY` (from console.anthropic.com) in `.env.local` and in Netlify.
  Each tidy-up is one short request to Claude Opus 5.5 at low effort. Until the key is set, the paste tab says
  it isn't switched on.
- WhatsApp doesn't let apps post into groups, so sending stays one tap by the broker ("Share on WhatsApp").
