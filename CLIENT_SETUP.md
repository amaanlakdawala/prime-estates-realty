# Adding a new client firm

One website, one database and one admin panel serve every client. Each firm gets:

- its own website at `yoursite/<their-name>`, e.g. `delightful-otter-34d9ac.netlify.app/seabreeze`
- a login that sees and changes **only that firm's** listings, enquiries and profile

The separation is enforced by the database's security rules, not just hidden in the pages: a firm's login cannot read, change or delete another firm's listings, enquiries or photos.

Time per client: about 5 minutes. No Netlify or Supabase setup is needed.

## Steps

1. Sign in at `/login` with your platform admin login and open **Firms**.
2. Under **Add a firm**, enter the firm name. A web address is suggested from the name; change it if you like. Add the city and phone, then select **Create firm**.
3. On the firm's page, under **Login**, enter the owner's email. Keep the generated password or type one, then select **Create login**. Send them the email and password. They sign in at `/login`.
4. Under **Website details**, fill in their address, areas covered (comma-separated), email, office hours, founding year and, if they have one, their MahaRERA agent number. Save.
5. Optional: select **Manage listings & enquiries** to add their first listings for them. Select **Back to all firms** when done.

## Before their site goes live

- [ ] Name, phone, address and founding year are the firm's **real** details.
- [ ] **Demo firm** is **unticked**. It shows sample testimonials and a sample team, and is only for your own demo sites. On a real firm's site those would look like invented reviews.
- [ ] Their first listings are added, with real photos.
- [ ] They can sign in and see their own listings.
- [ ] A test enquiry from their website appears under **Enquiries** in their login.

## Day to day

| Task | Where |
|---|---|
| Client forgot their password | **Logins** → open their login → **Set password** |
| Client stops paying | Firm page → **Pause firm**. Their site goes offline and their login stops working. Nothing is deleted; **Resume firm** brings it back. |
| Add or edit a client's listings yourself | Firm page → **Manage listings & enquiries** |
| Client changes phone or address | They can do it themselves under **Firm profile**, or you can on their firm page |

## Demo sites for pitching

Create a firm with the prospect's name, tick **Demo firm**, and add 3–5 of their real listings before the meeting. Untick **Demo firm** if they sign up, or delete the demo and create their real firm.

## Later: subdomains

Websites are path-based today (`/seabreeze`). Moving to subdomains (`seabreeze.yourbrand.in`) needs your own domain with a wildcard DNS record in Netlify, plus a small change so links on a firm's site drop the `/seabreeze` prefix (`base` in `toSite`, `lib/site.js`).
