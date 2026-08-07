const express = require("express");
const multer = require("multer");
const router = express.Router();
const { importExcel, exportExcel } = require("../controllers/uploadController");
const { protect, allowRoles } = require("../middleware/auth");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/import", protect, allowRoles("admin", "manager"), upload.single("file"), importExcel);
router.get("/export", protect, exportExcel);

module.exports = router;
