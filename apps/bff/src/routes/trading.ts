import type { FastifyInstance } from "fastify";

export async function tradingRoutes(app: FastifyInstance) {
  app.get("/positions", async () => {
    return {
      positions: [
        {
          id: "1", exchange: "binance", symbol: "BTC/USDT", side: "long",
          entryPrice: 69850, currentPrice: 72192, quantity: 0.15, leverage: 5,
          unrealizedPnl: 351.3, unrealizedPnlPct: 3.35, marginUsed: 2095.5,
          liquidationPrice: 59200, openedAt: Date.now() - 86400000 * 3,
        },
      ],
    };
  });

  app.post("/order", async (request) => {
    // Placeholder - will proxy to Python engine in Phase 6
    return { orderId: `order_${Date.now()}`, status: "received" };
  });
}
