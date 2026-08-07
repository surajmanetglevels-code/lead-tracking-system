const mongoose = require("mongoose");

/**
 * One document per lead that matched on phone number between your real
 * MongoDB capture collection (source/UTM truth) and the Excel Leads tab
 * (call-journey truth). Only phones present on BOTH sides ever get a
 * document here — that's enforced by the matching script, not by this
 * schema, but it's the entire reason this collection exists.
 */
const matchedLeadSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    // "live" = matched against your real capture collection.
    // "demo" = matched against the bundled demo capture data, for trying
    // this feature out without touching real data.
    mode: { type: String, enum: ["live", "demo"], default: "live", index: true },

    // ---- from MongoDB (source-of-truth attribution) ----
    fullName: { type: String, default: "" },
    source: { type: String, default: "" },
    utmSource: { type: String, default: "" },
    utmMedium: { type: String, default: "" },
    utmCampaign: { type: String, default: "" },
    utmContent: { type: String, default: "" },
    utmTerm: { type: String, default: "" },
    capturedAt: { type: Date },

    // ---- from Excel (call-journey truth) ----
    excelUserid: { type: String, default: "" },
    excelCustomerName: { type: String, default: "" },
    excelSource: { type: String, default: "" }, // Excel's own (coarser) Source column, kept for reference
    excelLeadType: { type: String, default: "" },
    excelStage: { type: String, default: "" }, // normalized into the dashboard's fixed stages
    excelRawStage: { type: String, default: "" }, // original free-text stage, kept for audit
    excelDropReason: { type: String, default: "" },
    excelAgent: { type: String, default: "" },
    excelGroupLeader: { type: String, default: "" },
    excelLastFeedback: { type: String, default: "" },
    excelLostReason: { type: String, default: "" },
    excelLeadDate: { type: Date },
    excelAmountCollected: { type: Number, default: 0 },

    // ---- trial journey fields from the lead-journey Google Sheet ----
    hasTrial: { type: Boolean, default: false, index: true },
    trialStart: { type: Date },
    trialDay1: { type: Date },
    trialDay2: { type: Date },
    trialDay3: { type: Date },
    trialDay4: { type: Date },
    trialExtendedUntil: { type: Date },
    trialCompletedAt: { type: Date },
    trialStatus: { type: String, default: "" },
    trialReason: { type: String, default: "" },
    trialConviction: { type: String, default: "" },
    trialFirstContact: { type: Date },
    trialCallTimestamps: { type: String, default: "" },
    trialUnreachableTry: { type: Number, default: 0 },
    trialRawRow: { type: mongoose.Schema.Types.Mixed },

    // ---- from Paid Subscription Google Sheet (conversion truth) ----
    isConverted: { type: Boolean, default: false, index: true },
    paymentAmount: { type: Number, default: 0 },
    paymentDate: { type: Date },
    paymentStudentName: { type: String, default: "" },
    paymentCourse: { type: String, default: "" },
    paymentPlan: { type: String, default: "" },
    paymentStatus: { type: String, default: "" },
    paymentTransactionId: { type: String, default: "" },
    paymentTransactionCount: { type: Number, default: 0 },
    paymentRawRow: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, collection: "matched_leads" }
);

matchedLeadSchema.index({ phone: 1, mode: 1 }, { unique: true });
matchedLeadSchema.index({ utmSource: 1, excelStage: 1 });

module.exports = mongoose.model("MatchedLead", matchedLeadSchema);
