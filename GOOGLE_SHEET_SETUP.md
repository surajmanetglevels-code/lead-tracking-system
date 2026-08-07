# Google Sheet Live Sync Setup

This version reads the Google Sheet directly in memory. It does not save a copy inside `server/data`.

## 1. Share the sheet

In Google Sheets, click **Share** and set:

`General access -> Anyone with the link -> Viewer`

The application only needs read access.

## 2. Configure MongoDB

Open `server/.env` and replace these values:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
```

The supplied Google Sheet URL and worksheet `gid` are already configured.

## 3. Install and run

Backend:

```bash
cd server
npm install
npm run dev
```

Frontend in another terminal:

```bash
cd client
npm install
npm run dev
```

## Live behavior

Every 60 seconds the backend fetches the latest Google Sheet rows and matches them with the configured MongoDB capture collection by normalized phone number.

- Added/updated sheet row -> `matched_leads` is inserted or updated.
- Deleted sheet row -> corresponding stale `matched_leads` record is deleted on the next successful sync.
- Deleted MongoDB submission -> corresponding stale `matched_leads` record is deleted on the next successful sync.
- Google Sheet/network failure -> existing `matched_leads` data is kept; the system does not delete records based on a failed fetch.
- Backend stopped -> no synchronization happens. On restart, an immediate full sync runs.

The polling interval can be changed with:

```env
EXCEL_SYNC_INTERVAL_SECONDS=60
```

The minimum accepted value is 15 seconds.
