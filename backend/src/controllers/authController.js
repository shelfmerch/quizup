const { body, validationResult } = require("express-validator");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: errors.array()[0].msg });
  }
  return null;
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const sanitizeUsernameBase = (value) => {
  const base = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (base.length >= 3) return base.slice(0, 30);
  return `user_${base}`.slice(0, 30);
};

const generateUniqueUsername = async (email) => {
  const local = String(email || "").split("@")[0] || "user";
  const base = sanitizeUsernameBase(local);
  let candidate = base;
  let attempt = 0;
  while (attempt < 20) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.exists({ username: candidate });
    if (!exists) return candidate;
    attempt += 1;
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    candidate = `${base.slice(0, Math.max(3, 30 - 5))}_${suffix}`.slice(0, 30);
  }
  // Fallback: time-based suffix
  return `${base.slice(0, 20)}_${Date.now().toString().slice(-6)}`.slice(0, 30);
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
      if (!user.passwordHash) {
        return res.status(401).json({ error: "This account uses Google sign-in" });
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

// POST /api/auth/google
const googleLogin = [
  body("credential").notEmpty().withMessage("Missing Google credential"),

  async (req, res) => {
    const validationError = handleValidationErrors(req, res);
    if (validationError !== null) return;

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: "Google auth is not configured" });
    }

    const { credential } = req.body;

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        return res.status(401).json({ error: "Invalid Google token" });
      }

      const email = String(payload.email).toLowerCase();
      const googleId = String(payload.sub);

      let user = await User.findOne({ email });
      if (!user) {
        const username = await generateUniqueUsername(email);
        user = new User({
          username,
          email,
          googleId,
          displayName: payload.name || username,
          avatarUrl: payload.picture || "",
          lastActive: new Date(),
        });
        await user.save();
      } else {
        let changed = false;
        if (!user.googleId) {
          user.googleId = googleId;
          changed = true;
        }
        user.lastActive = new Date();
        changed = true;
        if (payload.name && !user.displayName) {
          user.displayName = payload.name;
        }
        if (payload.picture && !user.avatarUrl) {
          user.avatarUrl = payload.picture;
        }
        if (changed) await user.save();
      }

      const token = signToken(user._id.toString());
      return res.json({ token, user: user.toProfile() });
    } catch (err) {
      console.error("[Auth] google login error:", err);
      return res.status(401).json({ error: "Google sign-in failed" });
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

module.exports = { signup, login, googleLogin, getMe };
