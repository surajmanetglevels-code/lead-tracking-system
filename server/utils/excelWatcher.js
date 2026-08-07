/**
 * Unified spreadsheet synchronizer.
 *
 * EXCEL_SOURCE_TYPE=google_sheet:
 *   Polls the supplied Google Sheet link. The file is fetched into memory and
 *   is never permanently stored in the backend folder.
 *
 * EXCEL_SOURCE_TYPE=local:
 *   Watches a local .xlsx file with chokidar.
 */
require("dotenv").config();
const path = require("path");
const chokidar = require("chokidar");
const { run: runMatch } = require("./matchCapturedLeadsWithExcel");

const DEFAULT_PATH = path.join(__dirname, "..", "data", "sample-leads-export.xlsx");

const state = {
  enabled: false,
  sourceType: "local",
  source: null,
  mode: "live",
  intervalSeconds: 60,
  isSyncing: false,
  lastSyncedAt: null,
  lastResult: null,
  lastError: null,
  syncCount: 0,
};

let watcherInstance = null;
let pollTimer = null;
let debounceTimer = null;

function getSyncState() {
  return { ...state };
}

function loadConfiguration(force = false) {
  state.enabled =
    force || String(process.env.EXCEL_SYNC_ENABLED || process.env.EXCEL_WATCH_ENABLED || "false").toLowerCase() === "true";
  state.sourceType =
    String(process.env.EXCEL_SOURCE_TYPE || "local").toLowerCase() === "google_sheet"
      ? "google_sheet"
      : "local";
  state.mode = process.env.EXCEL_WATCH_MODE === "demo" ? "demo" : "live";
  state.intervalSeconds = Math.max(
    15,
    Number(process.env.EXCEL_SYNC_INTERVAL_SECONDS || 60) || 60
  );
  state.source =
    state.sourceType === "google_sheet"
      ? process.env.GOOGLE_SHEET_URL || null
      : process.env.EXCEL_WATCH_PATH || DEFAULT_PATH;
}

async function triggerSync({ manageConnection = false, reason = "manual" } = {}) {
  if (state.isSyncing) {
    console.log("[sheet-sync] Sync already running; skipping duplicate trigger.");
    return state.lastResult;
  }

  state.isSyncing = true;
  console.log(`[sheet-sync] Starting (${reason}, source=${state.sourceType}, mode=${state.mode})...`);

  try {
    const result = await runMatch({
      filePath: state.sourceType === "local" ? state.source : undefined,
      googleSheetUrl: state.sourceType === "google_sheet" ? state.source : undefined,
      paymentGoogleSheetUrl: process.env.PAYMENT_GOOGLE_SHEET_URL || undefined,
      sourceType: state.sourceType,
      mode: state.mode,
      manageConnection,
    });

    state.lastResult = result;
    state.lastError = null;
    state.lastSyncedAt = new Date();
    state.syncCount += 1;
    console.log(
      `[sheet-sync] Complete: ${result.matched} matches, ` +
        `${result.staleRecordsDeleted} stale dashboard records removed.`
    );
    return result;
  } catch (error) {
    // Important: runMatch only deletes stale records after the remote sheet was
    // downloaded and parsed successfully. A network/private-sheet failure does
    // not wipe matched_leads.
    state.lastError = error.message;
    console.error("[sheet-sync] Failed:", error.message);
    throw error;
  } finally {
    state.isSyncing = false;
  }
}

function scheduleLocalSync(reason) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    triggerSync({ manageConnection: false, reason }).catch(() => {});
  }, 500);
}

function startExcelWatcher({ force = false } = {}) {
  loadConfiguration(force);

  if (!state.enabled) {
    console.log("[sheet-sync] Disabled. Set EXCEL_SYNC_ENABLED=true to enable it.");
    return null;
  }

  if (state.sourceType === "google_sheet") {
    if (!state.source) {
      throw new Error("GOOGLE_SHEET_URL is required when EXCEL_SOURCE_TYPE=google_sheet.");
    }

    console.log(
      `[sheet-sync] Polling Google Sheet every ${state.intervalSeconds} seconds. ` +
        "No Excel file will be stored in the backend folder."
    );

    triggerSync({ manageConnection: false, reason: "server startup" }).catch(() => {});
    pollTimer = setInterval(() => {
      triggerSync({ manageConnection: false, reason: "scheduled Google Sheet poll" }).catch(() => {});
    }, state.intervalSeconds * 1000);
    return pollTimer;
  }

  console.log(`[sheet-sync] Watching local workbook: ${state.source}`);
  watcherInstance = chokidar.watch(state.source, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 200 },
  });
  watcherInstance
    .on("change", () => scheduleLocalSync("local file changed"))
    .on("add", () => scheduleLocalSync("local file appeared"))
    .on("error", (error) => console.error("[sheet-sync] Watcher error:", error.message));

  triggerSync({ manageConnection: false, reason: "server startup" }).catch(() => {});
  return watcherInstance;
}

function stopExcelWatcher() {
  if (watcherInstance) {
    watcherInstance.close();
    watcherInstance = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

module.exports = { startExcelWatcher, stopExcelWatcher, triggerSync, getSyncState };

if (require.main === module) {
  const connectDB = require("../config/db");
  connectDB().then(() => startExcelWatcher({ force: true }));
}
