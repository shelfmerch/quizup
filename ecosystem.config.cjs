/**
 * PM2 process file — run from repo root:
 *   npm run pm2:start     (first time or after clone)
 *   npm run pm2:reload    (rebuild frontend + zero-downtime reload)
 *
 * Port, MongoDB, JWT, CLIENT_URL, etc. still come from backend/.env (dotenv).
 * Keep NODE_ENV/HOST here so production binding is reliable even if .env is incomplete.
 */
const path = require("path");

module.exports = {
  apps: [
    {
      name: "quizup",
      cwd: path.join(__dirname, "backend"),
      script: "src/server.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      kill_timeout: 5_000,
      listen_timeout: 10_000,
      // Run Node directly (avoid `npm start` — cleaner signals & fewer restarts)
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
      },
    },
  ],
};
