const jwt = require("jsonwebtoken");

const JWT_SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET not set in environment");
  return process.env.JWT_SECRET;
};

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Issue a signed JWT for a user.
 * @param {string} userId - MongoDB _id as string
 * @returns {string} signed JWT token
 */
const signToken = (userId) => {
  return jwt.sign({ sub: userId }, JWT_SECRET(), { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verify a JWT and return its payload, or null on failure.
 * @param {string} token
 * @returns {{ sub: string } | null}
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET());
  } catch {
    return null;
  }
};

module.exports = { signToken, verifyToken };
