const express = require("express");
const router = express.Router();
const { login, register, listAgents } = require("../controllers/authController");
const { protect, allowRoles } = require("../middleware/auth");

router.post("/login", login);
router.post("/register", protect, allowRoles("admin"), register);
router.get("/agents", protect, listAgents);

module.exports = router;
