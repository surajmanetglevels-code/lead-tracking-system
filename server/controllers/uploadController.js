const Lead = require("../models/Lead");
const { parseLeadsWorkbook } = require("../utils/excelParser");
const { buildLeadsWorkbookBuffer } = require("../utils/exportExcel");
const { STATUS_STAGES } = require("../models/Lead");

function generateLeadId() {
  return "LD-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(Math.random() * 900 + 100);
}

// POST /api/upload/import  (multipart/form-data, field name: file)
// Bulk-imports the existing global Excel sheet into MongoDB.
async function importExcel(req, res) {
  if (!req.file) return res.status(400).json({ message: "No file uploaded (field name must be 'file')" });

  const rows = parseLeadsWorkbook(req.file.buffer);
  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const row of rows) {
    if (!row.name || !row.phone) {
      skipped++;
      continue;
    }
    try {
      const existing = await Lead.findOne({ phone: row.phone });
      if (existing) {
        skipped++;
        continue; // avoid duplicate import; use status update endpoint to modify existing leads
      }
      const status = STATUS_STAGES.includes(row.status) ? row.status : "New";
      await Lead.create({
        leadId: generateLeadId(),
        name: row.name,
        phone: row.phone,
        email: row.email,
        source: row.source || "Unknown",
        campaign: row.campaign,
        landingPageUrl: row.landingPageUrl,
        currentStatus: status,
        dropReason: row.dropReason,
        assignedAgentName: row.assignedAgent,
        history: [{ status, note: "Imported from Excel sheet", changedAt: new Date() }],
        source_meta: { importedFromExcel: true, rawRow: row.rawRow },
      });
      created++;
    } catch (err) {
      errors.push({ row: row.phone, error: err.message });
    }
  }

  res.json({ totalRows: rows.length, created, skipped, errors });
}

// GET /api/upload/export
async function exportExcel(req, res) {
  const leads = await Lead.find({}).sort({ createdAt: -1 });
  const buffer = buildLeadsWorkbookBuffer(leads);
  res.setHeader("Content-Disposition", "attachment; filename=leads_export.xlsx");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
}

module.exports = { importExcel, exportExcel };
