const mongoose = require("mongoose");

const STATUS_STAGES = [
  "New",
  "Assigned",
  "Contacted",
  "Follow-up",
  "Trial Given",
  "Paid",
  "Dropped",
];

const historyEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUS_STAGES, required: true },
    reason: { type: String, default: "" }, // required in practice when status === 'Dropped'
    note: { type: String, default: "" },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    agentName: { type: String, default: "" }, // denormalized for quick display
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    leadId: { type: String, unique: true, index: true }, // human-friendly id, also used to reconcile with Excel
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, default: "" },

    source: { type: String, required: true, trim: true }, // e.g. Facebook, Google Ads, Instagram, Website
    campaign: { type: String, default: "" },
    landingPageUrl: { type: String, default: "" },
    leadType: { type: String, default: "" }, // e.g. New / Renewal / Hot Lead (from real sheet's "Type" column)

    currentStatus: { type: String, enum: STATUS_STAGES, default: "New" },
    dropReason: { type: String, default: "" },
    rawStage: { type: String, default: "" }, // original free-text stage value before normalization, kept for audit

    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedAgentName: { type: String, default: "" },
    groupLeader: { type: String, default: "" }, // one level up from agent, per the real org structure

    history: { type: [historyEntrySchema], default: [] },

    isDuplicate: { type: Boolean, default: false },
    duplicateOfLeadId: { type: String, default: "" },

    source_meta: {
      importedFromExcel: { type: Boolean, default: false },
      rawRow: { type: mongoose.Schema.Types.Mixed },
    },
  },
  // Explicit collection name — deliberately NOT "leads", so this dashboard's
  // own operational data can never collide with a real production
  // lead-capture collection that might already be named "leads" in the same
  // database (see models/CapturedLead.js for how that collection is read).
  { timestamps: true, collection: "leads" }
);

leadSchema.index({ source: 1, currentStatus: 1 });
leadSchema.index({ createdAt: 1 });

leadSchema.statics.STATUS_STAGES = STATUS_STAGES;

module.exports = mongoose.model("Lead", leadSchema);
module.exports.STATUS_STAGES = STATUS_STAGES;
