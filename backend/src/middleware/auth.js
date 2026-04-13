const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");

/**
 * Express middleware — verifies Bearer JWT and attaches req.user.
 * Returns 401 if missing or invalid, 403 if user not found.
 */
const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const user = await User.findById(payload.sub).lean();
  if (!user) {
    return res.status(403).json({ error: "User no longer exists" });
  }

  req.user = user;
  next();
};

module.exports = { requireAuth };
