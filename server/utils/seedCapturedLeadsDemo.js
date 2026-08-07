/**
 * Seeds a LOCAL DEMO capture collection ("captured_leads_demo") with
 * synthetic source/UTM data, reusing phone numbers from the bundled sample
 * Excel sheet — so the phone-matching script has something real to match
 * against, without ever touching your actual production capture collection.
 *
 * Usage: npm run seed:captured-demo
 */
require("dotenv").config();
const path = require("path");
const XLSX = require("xlsx");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { getCapturedLeadModel } = require("../models/CapturedLead");
const { normalizePhone } = require("./phoneNormalize");

const UTM_COMBOS = [
  { utmSource: "google", utmMedium: "cpc", utmCampaign: "search_brand_terms", utmContent: "homepage", utmTerm: "online course" },
  { utmSource: "facebook", utmMedium: "paid_social", utmCampaign: "fb_leadgen_july", utmContent: "video_ad", utmTerm: "" },
  { utmSource: "instagram", utmMedium: "paid_social", utmCampaign: "ig_reels_promo", utmContent: "reel_1", utmTerm: "" },
  { utmSource: "google", utmMedium: "organic", utmCampaign: "", utmContent: "", utmTerm: "" },
  { utmSource: "direct", utmMedium: "none", utmCampaign: "", utmContent: "", utmTerm: "" },
  { utmSource: "youtube", utmMedium: "paid_video", utmCampaign: "yt_prerolls_q3", utmContent: "preroll_15s", utmTerm: "" },
];
const SOURCES = ["wordpress", "landing_page_v2", "facebook_ads", "google_ads", "referral"];

function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function run() {
  await connectDB();
  const CapturedLead = getCapturedLeadModel("captured_leads_demo");

  console.log("Clearing existing demo captured-lead documents...");
  await CapturedLead.deleteMany({});

  const workbookPath = path.join(__dirname, "..", "data", "sample-leads-export.xlsx");
  const workbook = XLSX.readFile(workbookPath);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets["Leads"], { defval: null });

  let created = 0;
  const seenPhones = new Set();
  for (const row of rows) {
    const phone = normalizePhone(row["Phone"]);
    if (!phone || seenPhones.has(phone)) continue;
    seenPhones.add(phone);
    if (created >= 400) break; // a representative sample is enough for a demo

    const combo = randomOf(UTM_COMBOS);
    await CapturedLead.create({
      fullName: row["Customer Name"] || "Unknown",
      phone,
      source: randomOf(SOURCES),
      ...combo,
      createdAt: row["Lead Date"] ? new Date(row["Lead Date"]) : new Date(),
    });
    created++;
  }

  console.log(`Created ${created} demo captured-lead documents in collection "captured_leads_demo".`);
  console.log(`Next: npm run match:excel -- --demo`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
