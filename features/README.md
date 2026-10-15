# Features

Larger features live in their own folder here, so each one can be read, changed or removed on its own.

A feature folder holds its logic, its admin screens, its database setup and its own README. Next.js only
allows pages and API routes under `app/`, so `app/` keeps thin route files that import from the feature
folder and contain no logic of their own. Code used by more than one feature goes in `shared/`.

| Folder | What it is | Status |
| --- | --- | --- |
| [`social-replies/`](social-replies/README.md) | Automatic replies to comments on each firm's Instagram and Facebook | Planned |
| [`whatsapp-assistant/`](whatsapp-assistant/README.md) | AI replies to clients who message the firm's WhatsApp | Planned |
| [`email/`](email/README.md) | Alerts to firms and automatic emails to clients | Planned |
| [`shared/`](shared/README.md) | Meta client and text AI assistant, used by the features above | Planned |

Older features (website, listings, AI calls, reels, lead finder) predate this folder and still live in
`app/`, `components/` and `lib/`.

## What the planned features need from outside

| Need | social-replies | whatsapp-assistant | email |
| --- | :---: | :---: | :---: |
| Meta developer app (one app for all three Meta products) | ✓ | ✓ | |
| Meta Business Verification + App Review (to serve client firms) | ✓ | ✓ | |
| Anthropic API key (AI replies) | ✓ | ✓ | |
| WhatsApp Business number per firm | | ✓ | |
| Your own domain + email provider (e.g. Resend) | | | ✓ |
