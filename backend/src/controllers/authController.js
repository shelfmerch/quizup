const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: errors.array()[0].msg });
  }
  return null;
};

// POST /api/auth/signup
const signup = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be 3–30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),
  body("email").isEmail().normalizeEmail().withMessage("Invalid email address"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  async (req, res) => {
    const validationError = handleValidationErrors(req, res);
    if (validationError !== null) return;

    const { username, email, password } = req.body;

    try {
      // Check uniqueness
      const existing = await User.findOne({
        $or: [{ email }, { username }],
      });
      if (existing) {
        const field = existing.email === email ? "Email" : "Username";
        return res.status(409).json({ error: `${field} is already taken` });
      }

      const passwordHash = await User.hashPassword(password);
      const user = new User({ username, email, passwordHash });
      await user.save();

      const token = signToken(user._id.toString());

      return res.status(201).json({ token, user: user.toProfile() });
    } catch (err) {
      console.error("[Auth] signup error:", err);
      return res.status(500).json({ error: "Server error during signup" });
    }
  },
];

// POST /api/auth/login
const login = [
  body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
  body("password").notEmpty().withMessage("Password is required"),

  async (req, res) => {
    const validationError = handleValidationErrors(req, res);
    if (validationError !== null) return;

    const { email, password } = req.body;

    try {
      // Must select passwordHash explicitly (select: false in schema)
      const user = await User.findOne({ email }).select("+passwordHash");
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Update lastActive
      user.lastActive = new Date();
      await user.save();

      const token = signToken(user._id.toString());

      return res.json({ token, user: user.toProfile() });
    } catch (err) {
      console.error("[Auth] login error:", err);
      return res.status(500).json({ error: "Server error during login" });
    }
  },
];

// GET /api/auth/me  (protected — requireAuth middleware attaches req.user)
const getMe = async (req, res) => {
  try {
    // req.user is the lean object from middleware; fetch fresh for accuracy
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user: user.toProfile() });
  } catch (err) {
    console.error("[Auth] getMe error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = { signup, login, getMe };
