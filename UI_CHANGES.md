# Requested UI Changes

This version keeps the existing Google Sheet synchronization, MongoDB matching, analytics, authentication, and navigation unchanged, except for the following requested UI changes:

1. Dashboard import/export controls were removed because data is fetched directly from the configured Google Sheet.
2. The Leads detail page is now read-only. Agent assignment and status update forms were removed. It displays MongoDB source/UTM details, the Excel call journey, and the available lead journey timeline.
3. Source Match now uses live data only. The demo selector was removed, while live synchronization status and the **Sync now** action remain available.
