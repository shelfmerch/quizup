require("dotenv").config();
const http = require("http");
const connectDB = require("./config/db");
const app = require("./app");
const initSockets = require("./sockets");

const PORT = process.env.PORT || 3001;

const start = async () => {
  // 1. Create HTTP server from Express app
  const server = http.createServer(app);

  // 2. Attach Socket.io to the same HTTP server
  initSockets(server);

  // 3. Listen (do this even if Mongo is temporarily down)
  server.listen(PORT, () => {
    console.log(`[Server] QuizUp backend running on http://localhost:${PORT}`);
    console.log(`[Server] Socket.io attached`);
    console.log(`[Server] Env: ${process.env.NODE_ENV || "development"}`);
  });

  // 4. Connect MongoDB (retry loop lives inside connectDB)
  connectDB();

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[Server] SIGTERM received — shutting down");
    server.close(() => process.exit(0));
  });
};

start();
