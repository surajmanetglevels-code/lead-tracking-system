# Lead Source Tracking & Conversion Dashboard (MERN)

A working scaffold that implements the FRD: leads are captured with their source,
every status change is tracked as a timestamped journey, and a dashboard shows
source-wise funnels, drop-off reasons, and agent performance. Excel import/export
is built in so it can sit alongside your existing sheet during rollout.

## Stack
- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT auth, `xlsx` for Excel import/export
- **Frontend:** React (Vite), React Router, Recharts, Axios

## Folder structure
```
lead-tracking-mern/
├── server/          Express API + MongoDB models
│   ├── config/       DB connection
│   ├── models/        Lead.js (with embedded journey history), User.js
│   ├── controllers/   auth, leads, analytics, upload(excel)
│   ├── routes/
│   ├── middleware/    JWT auth guard, error handler
│   └── utils/         excelParser, exportExcel, seed.js (demo data)
└── client/           React dashboard
    └── src/
        ├── api/        axios client
        ├── pages/      Login, Dashboard, Leads, LeadJourney
        └── components/ Sidebar, StatusBadge
```

## 1. Prerequisites
- Node.js 18+
- A MongoDB instance — either local (`mongod`) or a free MongoDB Atlas cluster

## 2. Backend setup
```bash
cd server
npm install
cp .env.example .env
# edit .env and set MONGO_URI to your local or Atlas connection string
npm run seed     # creates demo admin/agents + 150 sample leads across sources
npm run dev      # starts API on http://localhost:5000
```
Demo login created by the seed script: **admin@demo.com / admin123**

## 3. Frontend setup
```bash
cd client
npm install
npm run dev      # starts dashboard on http://localhost:5173
```
The Vite dev server proxies `/api` calls to `http://localhost:5000`, so just
open `http://localhost:5173` and log in.

## 4. Key API endpoints
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/leads` | Capture a new lead (this is what your landing-page webhook would call) |
| GET | `/api/leads` | List/filter leads (by source, status, agent, date, search) |
| GET | `/api/leads/:id` | Full journey/history for one lead |
| PATCH | `/api/leads/:id/assign` | Assign/reassign an agent |
| PATCH | `/api/leads/:id/status` | Update status (drop reason required when status = Dropped) |
| GET | `/api/analytics/overview` | Total leads, conversion rate, drop rate |
| GET | `/api/analytics/by-source` | Leads received per platform |
| GET | `/api/analytics/funnel` | Stage counts per source (New→Contacted→Trial→Paid/Dropped) |
| GET | `/api/analytics/drop-reasons` | Top drop reasons per source |
| GET | `/api/analytics/agent-performance` | Per-agent conversion rate |
| POST | `/api/upload/import` | Bulk-import your existing global Excel sheet |
| GET | `/api/upload/export` | Export current MongoDB leads back to Excel |

## 5. Importing your real "Daily Sales Command Sheet" data
A tailored, re-runnable import script is included at
`server/utils/importRealLeadsSheet.js`, built specifically for the 43-column
`Leads` tab format (Userid, Lead Date, Phone, Customer Name, Source, Stage,
Agent, Group Leader, Amount Collected, etc.). It:

- Normalizes messy free-text `Stage` values (`Unreachable` / `unreacheable` /
  `unrechebale` → one canonical stage) into the dashboard's fixed stages,
  while keeping the original text in `rawStage` for audit.
- Treats `Amount Collected` > 0 as proof of payment even if `Stage` was never
  updated to "Enrolled".
- Skips rows with no phone number, and skips phones already in the database
  so it's safe to re-run.
- **Known limitation:** this legacy sheet stores each lead's current stage
  only, not a timestamped log of every change — so backfilled leads get at
  most two journey points (captured, then current stage). Every stage change
  made through the dashboard *going forward* gets its own real timestamp.

A copy of the sheet you provided is bundled at
`server/data/sample-leads-export.xlsx` so you can try the import immediately:

```bash
cd server
npm install
npm run seed          # optional: creates demo admin/agent logins first
npm run import:real   # imports server/data/sample-leads-export.xlsx
```

To import a different file later: `node utils/importRealLeadsSheet.js /path/to/file.xlsx`

## 6. Matching your REAL capture collection with the Excel journey (by phone)
If you already have a MongoDB collection where leads are captured with clean
source/UTM attribution (`fullName`, `phone`, `source`, `utmSource`,
`utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`, `createdAt`) — separate
from this dashboard's own data — you can join it against the Excel call
journey by phone number. **Only phone numbers present on BOTH sides are kept**;
anything captured but never called, or called but never digitally captured,
is intentionally left out of this view.

This is read-only against your real collection — nothing here ever writes to
it. The join result is saved into its own `matched_leads` collection, so it
never touches your dashboard's own `dashboard_leads` collection either.

**Try it safely with demo data first (no real DB required beyond your own Atlas/local Mongo):**
```bash
cd server
npm run seed:captured-demo     # creates synthetic source/UTM docs reusing phones from the bundled sheet
npm run match:excel -- --demo  # joins them against server/data/sample-leads-export.xlsx
```
Then open the dashboard and go to **Source Match** in the sidebar, with the mode selector set to "Demo data".

**Once ready for your real collection:**
1. In `server/.env`, set `CAPTURED_LEADS_COLLECTION` to the actual collection name your capture system writes to (defaults to `leads`).
2. Run: `npm run match:excel /path/to/your/excel/export.xlsx` (omit the path to use the bundled sample).
3. In the dashboard's **Source Match** page, switch the mode selector to "Live data".

Re-running `match:excel` at any time refreshes the matches (safe/idempotent — upserts by phone, and removes stale matches whose MongoDB document is gone).

## 7. Automatic sync — no more manually re-running the import
Instead of running `npm run match:excel` by hand every time the Excel sheet changes, the server can watch the file on disk and re-run the match automatically the moment you save it.

**Setup:**
1. In `server/.env`, set:
   ```
   EXCEL_WATCH_ENABLED=true
   EXCEL_WATCH_PATH=C:\path\to\your\actual\workbook.xlsx
   EXCEL_WATCH_MODE=live
   ```
   `EXCEL_WATCH_PATH` should point at the **real file you actually edit and save** — not necessarily the bundled sample. If your sheet lives in OneDrive/Google Drive Desktop/Dropbox, point this at wherever that sync client keeps the local copy on disk.
2. Restart the server (`npm run dev`). You'll see:
   ```
   [excel-watcher] Watching: C:\path\to\your\actual\workbook.xlsx (mode: live)
   ```
3. Edit and save the sheet as normal. A few seconds after saving, the server automatically re-runs the match and logs a summary — no manual command needed.

**In the dashboard:** the **Source Match** page shows a live banner — "🟢 Auto-sync on — watching `<path>` · last synced: 2m ago" — plus a **"🔄 Sync now"** button if you want to force an immediate re-sync without waiting for the debounce.

**API, if you want to check/trigger this programmatically:**
- `GET /api/matched/sync/status` — current watcher state, last sync time/result
- `POST /api/matched/sync/run` — trigger a sync immediately

**Notes:**
- This watches a **local file on disk**. If your "sheet" is actually a live Google Sheet (not a static `.xlsx` export), this mechanism can't see edits made directly in the browser — you'd need to export/download it to the watched path (or a Google Sheets API integration, which is a different feature).
- Debounced by ~2.5 seconds so a single "Save" (which can trigger several filesystem writes) doesn't cause duplicate syncs.
- Safe to leave enabled indefinitely — each sync is the same idempotent upsert-and-cleanup logic as running `match:excel` manually.
- You can also run the watcher completely standalone, outside the API server: `npm run watch:excel`.

## 8. Connecting your real landing pages
Point each landing page's form-submit webhook (or the automation that currently
writes to your shared sheet) at `POST /api/leads` with:
```json
{ "name": "...", "phone": "...", "email": "...", "source": "Facebook", "campaign": "...", "landingPageUrl": "..." }
```
In production, protect this endpoint with a per-source API key instead of a
user JWT — that's a small addition to `middleware/auth.js`.

## 9. What's intentionally left for you to extend
- Auto lead-assignment (round robin) — see Section 6 of the FRD
- WhatsApp/SMS acknowledgement on capture
- SLA alerting (uncontacted-too-long, drop-rate spikes)
- Production-grade auth (refresh tokens, password reset)

This is a functional starting point, not a finished production system — treat
it as Phase 1/2 of the FRD's implementation plan.
