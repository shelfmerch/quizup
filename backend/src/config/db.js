const mongoose = require("mongoose");

let isConnected = false;
let isConnecting = false;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const connectDB = async () => {
  if (isConnected) return;
  if (isConnecting) return;
  isConnecting = true;

  let attempt = 0;
  // Keep retrying — don't crash the server (lets /health work and avoids connection refused).
  // Routes that need DB will naturally fail until connected.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    try {
      const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
      if (!uri) throw new Error("MONGODB_URI or MONGO_URI must be set");
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      isConnected = true;
      isConnecting = false;
      console.log(`[MongoDB] Connected: ${conn.connection.host}`);
      return;
    } catch (err) {
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(5, attempt - 1));
      console.error(`[MongoDB] Connection failed (attempt ${attempt}). Retrying in ${delay}ms:`, err.message);
      // eslint-disable-next-line no-await-in-loop
      await wait(delay);
    }
  }
};

module.exports = connectDB;
