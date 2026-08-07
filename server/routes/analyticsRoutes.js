const express = require("express");
const router = express.Router();
const { overview, bySource, funnel, dropReasons, agentPerformance } = require("../controllers/analyticsController");
const { protect } = require("../middleware/auth");

router.get("/overview", protect, overview);
router.get("/by-source", protect, bySource);
router.get("/funnel", protect, funnel);
router.get("/drop-reasons", protect, dropReasons);
router.get("/agent-performance", protect, agentPerformance);

module.exports = router;
