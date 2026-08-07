const mongoose = require("mongoose");

/**
 * This mirrors your EXISTING, already-populated lead-capture collection —
 * the one your form/WordPress integration already writes to, containing
 * fullName, phone, source, and full UTM attribution (utmSource, utmMedium,
 * utmCampaign, utmContent, utmTerm) plus createdAt.
 *
 * This app treats that collection as READ-ONLY. Nothing here ever writes to
 * it, updates it, or deletes from it — it's only ever queried, so your real
 * capture pipeline can't be disturbed by anything in this dashboard.
 */
const capturedLeadSchema = new mongoose.Schema(
  {
    fullName: String,
    phone: String,
    source: String,
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    utmContent: String,
    utmTerm: String,
    createdAt: Date,
  },
  { strict: false } // tolerate any extra fields your real collection has that this app doesn't know about
);

// Returns a model bound to whichever collection name you point it at — your
// real production collection, or a local demo collection for trying this out
// without touching real data. Cached per collection name so repeated calls
// don't try to redefine the same Mongoose model.
function getCapturedLeadModel(collectionName) {
  const modelName = `CapturedLead__${collectionName}`;
  return mongoose.models[modelName] || mongoose.model(modelName, capturedLeadSchema, collectionName);
}

module.exports = { getCapturedLeadModel };
