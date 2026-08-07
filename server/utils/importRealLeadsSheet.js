/**
 * Import script for the "TG Levels — Daily Sales Command Sheet" workbook's
 * Leads tab (real production export, 43 columns) into the MongoDB Lead
 * collection used by this dashboard.
 *
 * This is a ONE-TIME / re-runnable migration script, not the live API import
 * (see routes/uploadRoutes.js for that). Run it directly:
 *
 *   node utils/importRealLeadsSheet.js [path/to/workbook.xlsx]
 *
 * If no path is given, it looks for ./data/sample-leads-export.xlsx
 *
 * WHAT THIS SCRIPT DOES (and does NOT do):
 * - Maps the sheet's real, messy "Stage" free-text into the fixed dashboard
 *   stages (New / Assigned / Contacted / Follow-up / Trial Given / Paid /
 *   Dropped), collapsing typo variants like "Unreachable" / "unreacheable" /
 *   "unrechebale" into one canonical value.
 * - Preserves the original stage text in `rawStage` so nothing is silently
 *   lost — you can always audit what the source data actually said.
 * - Treats "Amount Collected" > 0 as authoritative proof of payment, even if
 *   the Stage column wasn't updated to "Enrolled" — money received is a
 *   stronger signal than a manually-typed stage.
 * - HONEST LIMITATION: this legacy sheet only stores each lead's CURRENT
 *   stage, not a timestamped log of every stage change. So the "journey"
 *   this script creates has at most two points per lead: (1) captured on
 *   Lead Date, and (2) its current mapped stage. Going forward, once leads
 *   are worked through the dashboard's status-update screen instead of this
 *   sheet, every future stage change gets its own real timestamped entry —
 *   this script only backfills what the sheet actually recorded.
 */

require("dotenv").config();
const path = require("path");
const XLSX = require("xlsx");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Lead = require("../models/Lead");

const filePath = process.argv[2] || path.join(__dirname, "..", "data", "sample-leads-export.xlsx");

// ---- normalization helpers (same logic used to analyze the sheet) ----

function normalizeSource(raw) {
  if (!raw) return "Unknown/Blank";
  const s = String(raw).trim().toLowerCase();
  const map = {
    app: "App",
    web: "Website",
    webinar: "Webinar",
    manual: "Manual",
    "tg lite": "TG Lite",
    csr: "CSR",
    mentor: "Mentor",
    "landing page": "Landing Page",
    commo: "Commodity",
    commodity: "Commodity",
  };
  return map[s] || (raw ? String(raw).trim() : "Unknown/Blank");
}

// Returns { status, dropReason, note } for the dashboard's fixed STATUS_STAGES enum
function normalizeStage(rawStage, amountCollected) {
  if (amountCollected && Number(amountCollected) > 0) {
    return { status: "Paid", dropReason: "", note: `Amount collected: ₹${amountCollected}` };
  }
  if (!rawStage) return { status: "New", dropReason: "", note: "" };

  const s = String(rawStage).trim().toLowerCase();
  if (["unreachable", "unreacheable", "unrechebale", "hung up"].includes(s)) {
    return { status: "Dropped", dropReason: "Unreachable / could not connect", note: "" };
  }
  if (["ni", "nc", "ni loss cm", "band hai"].includes(s)) {
    return { status: "Dropped", dropReason: "Not interested", note: "" };
  }
  if (["contacted", "connected"].includes(s)) return { status: "Contacted", dropReason: "", note: "" };
  if (s === "fresh") return { status: "New", dropReason: "", note: "" };
  if (s === "in trial") return { status: "Trial Given", dropReason: "", note: "" };
  if (s === "enrolled") return { status: "Paid", dropReason: "", note: "" };

  // Anything unclassified: keep it visible rather than silently dropping it
  return { status: "Follow-up", dropReason: "", note: `Unclassified original stage: "${rawStage}"` };
}

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

async function run() {
  console.log(`Reading workbook: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  if (!workbook.SheetNames.includes("Leads")) {
    throw new Error(`No "Leads" sheet found. Sheets present: ${workbook.SheetNames.join(", ")}`);
  }
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets["Leads"], { defval: null });
  console.log(`Found ${rows.length} raw rows in the Leads tab.`);

  await connectDB();

  let created = 0;
  let skippedDuplicate = 0;
  let skippedInvalid = 0;
  const sourceCounts = {};
  const statusCounts = {};

  for (const row of rows) {
    const phone = row["Phone"] ? String(row["Phone"]).trim() : "";
    if (!phone) {
      skippedInvalid++;
      continue;
    }

    const existing = await Lead.findOne({ phone });
    if (existing) {
      skippedDuplicate++;
      continue;
    }

    const source = normalizeSource(row["Source"]);
    const { status, dropReason, note } = normalizeStage(row["Stage"], row["Amount Collected (₹)"]);
    const leadDate = toDate(row["Lead Date"]) || new Date();
    const feedback = row["Last Feedback  (one line)"] ? String(row["Last Feedback  (one line)"]).trim() : "";

    const history = [
      { status: "New", note: "Lead captured (backfilled from Excel migration)", changedAt: leadDate },
    ];
    if (status !== "New") {
      history.push({
        status,
        reason: dropReason,
        note: [note, feedback].filter(Boolean).join(" | "),
        agentName: row["Agent"] || "",
        changedAt: leadDate, // sheet has no per-stage timestamp; see script header note
      });
    }

    await Lead.create({
      leadId: row["Userid"] ? String(row["Userid"]).trim() : undefined,
      name: row["Customer Name"] ? String(row["Customer Name"]).trim() : "Unknown",
      phone,
      source,
      leadType: row["Type"] || "",
      currentStatus: status,
      dropReason,
      rawStage: row["Stage"] ? String(row["Stage"]).trim() : "",
      assignedAgentName: row["Agent"] || "",
      groupLeader: row["Group Leader"] || "",
      history,
      createdAt: leadDate,
      source_meta: { importedFromExcel: true, rawRow: row },
    });

    created++;
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  console.log("\n--- Import summary ---");
  console.log(`Created:            ${created}`);
  console.log(`Skipped (duplicate phone already in DB): ${skippedDuplicate}`);
  console.log(`Skipped (no phone number):               ${skippedInvalid}`);
  console.log("\nBy source:", sourceCounts);
  console.log("By mapped status:", statusCounts);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
