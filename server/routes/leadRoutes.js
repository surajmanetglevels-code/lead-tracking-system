const express = require("express");
const router = express.Router();
const { createLead, listLeads, getLead, assignLead, updateStatus } = require("../controllers/leadController");
const { protect } = require("../middleware/auth");

// Public-ish capture endpoint — in production, protect with an API key per landing page, not user JWT.
router.post("/", createLead);

router.get("/", protect, listLeads);
router.get("/:id", protect, getLead);
router.patch("/:id/assign", protect, assignLead);
router.patch("/:id/status", protect, updateStatus);

module.exports = router;
