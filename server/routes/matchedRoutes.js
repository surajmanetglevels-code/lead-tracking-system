const express = require("express");
const router = express.Router();
const c = require("../controllers/matchedAnalyticsController");
const { protect } = require("../middleware/auth");
const { getSyncState, triggerSync } = require("../utils/excelWatcher");

router.get("/analytics/overview", protect, c.overview);
router.get("/analytics/by-utm-source", protect, c.byUtmSource);
router.get("/analytics/funnel", protect, c.funnelByUtmSource);
router.get("/analytics/drop-reasons", protect, c.dropReasonsByUtmSource);
router.get("/leads", protect, c.listMatched);
router.get("/leads/:phone", protect, c.getOne);
router.get("/trials", protect, c.listTrials);
router.get("/trials/:phone", protect, c.getTrial);

// GET /api/matched/sync/status — is the watcher on, what's it watching, when did it last sync
router.get("/sync/status", protect, (req, res) => {
  res.json(getSyncState());
});

// POST /api/matched/sync/run — manually trigger a sync right now (e.g. a "Sync now" button)
router.post("/sync/run", protect, async (req, res) => {
  try {
    const result = await triggerSync({ manageConnection: false, reason: "manual API trigger" });
    res.json({ message: "Sync complete", result });
  } catch (err) {
    res.status(500).json({ message: err.message || "Sync failed" });
  }
});

module.exports = router;
