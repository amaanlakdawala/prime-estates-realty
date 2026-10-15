# Features

Larger features live in their own folder here, so each one can be read, changed or removed on its own.

A feature folder holds its logic, its admin screens, its database setup and its own README. Next.js only
allows pages and API routes under `app/`, so `app/` keeps thin route files that import from the feature
folder and contain no logic of their own.

| Folder | What it is | Status |
| --- | --- | --- |
| [`social-replies/`](social-replies/README.md) | Automatic replies to comments on each firm's Instagram and Facebook | Planned |

Older features (website, listings, AI calls, reels, lead finder) predate this folder and still live in
`app/`, `components/` and `lib/`.
