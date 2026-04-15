const express = require("express");
const router = express.Router();
const { signup, login, googleLogin, getMe } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleLogin);
router.get("/me", requireAuth, getMe);

module.exports = router;
