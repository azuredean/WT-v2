import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import { setupWebSocketGateway } from "./ws/gateway.js";
import { marketRoutes } from "./routes/market.js";
import { signalRoutes } from "./routes/signals.js";
import { whaleRoutes } from "./routes/whale.js";
import { tradingRoutes } from "./routes/trading.js";

const PORT = parseInt(process.env.BFF_PORT || "3001", 10);
const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8000";

async function start() {
  const app = Fastify({ logger: true });

  // CORS
  await app.register(cors, {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  });

  // WebSocket
  await app.register(websocket);

  // WebSocket gateway
  setupWebSocketGateway(app);

  // REST API proxy routes
  await app.register(marketRoutes, { prefix: "/api/market" });
  await app.register(signalRoutes, { prefix: "/api/signals" });
  await app.register(whaleRoutes, { prefix: "/api/whale" });
  await app.register(tradingRoutes, { prefix: "/api/trading" });

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: Date.now() }));

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🐳 Whale Tracker BFF running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

export { ENGINE_URL };
