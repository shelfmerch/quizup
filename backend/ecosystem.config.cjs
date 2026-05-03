/**
 * PM2: API + single pipeline worker (two processes).
 * Usage (from backend dir): pm2 start ecosystem.config.cjs
 * Or: pm2 start ecosystem.config.cjs --only quizup-api
 */
const path = require("path");
const backendRoot = __dirname;

module.exports = {
  apps: [
    {
      name: "quizup-api",
      script: path.join(backendRoot, "src/server.js"),
      cwd: backendRoot,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
    },
    {
      name: "quizup-pipeline-worker",
      script: path.join(backendRoot, "src/pipelineWorkerEntry.js"),
      cwd: backendRoot,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "10s",
    },
  ],
};
