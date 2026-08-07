const XLSX = require("xlsx");

/**
 * Reads an uploaded Excel file buffer and returns rows as plain objects.
 * Expected (flexible) columns: Name, Phone, Email, Source, Campaign,
 * LandingPageUrl, Status, DropReason, AssignedAgent
 */
function parseLeadsWorkbook(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows.map((row) => {
    // normalize keys case/spacing-insensitively
    const normalized = {};
    Object.keys(row).forEach((key) => {
      normalized[key.trim().toLowerCase().replace(/\s+/g, "")] = row[key];
    });
    return {
      name: String(normalized.name || normalized.leadname || "").trim(),
      phone: String(normalized.phone || normalized.contact || normalized.phonenumber || "").trim(),
      email: String(normalized.email || "").trim(),
      source: String(normalized.source || normalized.platform || "Unknown").trim(),
      campaign: String(normalized.campaign || "").trim(),
      landingPageUrl: String(normalized.landingpageurl || normalized.landingpage || "").trim(),
      status: String(normalized.status || "New").trim(),
      dropReason: String(normalized.dropreason || normalized.reason || "").trim(),
      assignedAgent: String(normalized.assignedagent || normalized.agent || "").trim(),
      rawRow: row,
    };
  });
}

module.exports = { parseLeadsWorkbook };
