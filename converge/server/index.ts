// ============================================
// CUSTOM SERVER FOR SOCKET.IO INTEGRATION
// This file creates a custom Node.js server that
// integrates Socket.IO with Next.js
// 
// Run with: npx ts-node --project tsconfig.server.json server/index.ts
// Or in dev: npm run dev:server
// ============================================

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initializeCollaborationServer } from "./socket/collaboration-server";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP server
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.IO collaboration server
  const collaborationServer = initializeCollaborationServer(httpServer);

  // Graceful shutdown handler
  const shutdown = async () => {
    console.log("\n🛑 Shutting down gracefully...");
    await collaborationServer.shutdown();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Start server
  httpServer.listen(port, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 CONVERGE - Real-Time Collaboration Platform           ║
║                                                            ║
║   Server running at: http://${hostname}:${port}                  ║
║   WebSocket ready for connections                          ║
║   Environment: ${dev ? "development" : "production"}                            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
});
