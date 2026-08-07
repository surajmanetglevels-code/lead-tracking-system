const XLSX = require("xlsx");

function buildLeadsWorkbookBuffer(leads) {
  const rows = leads.map((l) => ({
    LeadID: l.leadId,
    Name: l.name,
    Phone: l.phone,
    Email: l.email,
    Source: l.source,
    Campaign: l.campaign,
    Status: l.currentStatus,
    DropReason: l.dropReason,
    AssignedAgent: l.assignedAgentName,
    CreatedAt: l.createdAt ? new Date(l.createdAt).toISOString() : "",
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Leads");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

module.exports = { buildLeadsWorkbookBuffer };
