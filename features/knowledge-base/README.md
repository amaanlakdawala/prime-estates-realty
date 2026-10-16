# Knowledge base: towers and areas

What Riya knows about Mumbai on every firm's calls, kept by the platform owner in one shared list:

- **Towers and projects**: which area each one is in, other names callers use for it, developer, flat
  sizes and an approximate rate in ₹ per sq ft.
- **Areas**: each area's region and map position, so the system can work out which areas are close to
  each other and which are far.

## How Riya uses it

- **`lookup_place` tool** (`GET /api/voice/places?name=…`, needs the `x-voice-key` header).
  - **A tower:** returns its area, developer, sizes and nearby areas. The approximate rate is included
    only once its price is ticked as checked.
  - **An area:** returns the areas nearest to it, with distances.
  - **A region** (South Mumbai, SoBo, Western suburbs…): returns the areas in it.
  - **Unknown name:** says so, and Riya asks the caller instead of guessing.
- **`search_listings`** (`app/api/voice/listings/route.js`) uses the same data:
  - a region such as "South Mumbai" searches every area in it;
  - when nothing is listed where the caller asked, alternatives elsewhere come nearest first, each
    marked "very close", "close", "a bit far" or "far";
  - the nearby areas Riya may suggest come from the map.

Names are matched loosely, because callers' words arrive through speech-to-text: "Lodha World Park"
finds Lodha Park, and "oberoi sky-city" finds Oberoi Sky City. A word that's only part of a name,
such as "Lodha" on its own, is not matched.

Prices reach Riya already written in Hindi words (`lib/hindi-amount.js`), because she misread digits.

## Admin

**Towers & areas** in the platform admin menu (`/admin/knowledge`):
- search the list;
- edit a tower or add one;
- tick **Price checked** once a rate has been verified;
- add an area with its Google Maps position.

Firm logins can't open it. Changes reach calls within about 10 seconds.

## Files

| File | What it does |
| --- | --- |
| `schema.sql` | Tables `kb_areas` and `kb_projects`; only the platform admin can read or edit them |
| `seed.sql` | Starting list: 72 areas, 56 towers, every rate unchecked. Safe to re-run; it never overwrites edits |
| `lookup.js` | Name matching, regions, distances, nearby areas, spoken rates |
| `api.js` | The `lookup_place` tool (route: `app/api/voice/places/route.js`) |
| `actions.js` | Saving, removing and adding, from the admin page |
| `admin/KnowledgeAdmin.js` | The admin page (route: `app/admin/knowledge/page.js`) |

Setup: run `schema.sql`, then `seed.sql`, in Supabase (SQL Editor).
