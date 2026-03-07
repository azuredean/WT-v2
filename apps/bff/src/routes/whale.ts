import type { FastifyInstance } from "fastify";

export async function whaleRoutes(app: FastifyInstance) {
  app.get("/profiles", async () => {
    return {
      profiles: [
        { type: "smart_whale", count: 587, totalPnl: 82300000, avgLeverage: 3.2, longRatio: 0.73 },
        { type: "dumb_whale", count: 817, totalPnl: -37100000, avgLeverage: 8.5, longRatio: 0.62 },
        { type: "market_maker", count: 124, totalPnl: 5200000, avgLeverage: 1.0, longRatio: 0.50 },
        { type: "retail_herd", count: 45000, totalPnl: -18700000, avgLeverage: 15.0, longRatio: 0.70 },
        { type: "arbitrageur", count: 89, totalPnl: 2100000, avgLeverage: 2.0, longRatio: 0.50 },
      ],
    };
  });

  app.get("/activity", async () => {
    return {
      activities: [
        { id: "1", exchange: "binance", symbol: "BTC/USDT", participantType: "smart_whale", side: "buy", size: 2500000, price: 72150, timestamp: Date.now() - 120000 },
        { id: "2", exchange: "okx", symbol: "BTC/USDT", participantType: "dumb_whale", side: "sell", size: 1800000, price: 72200, timestamp: Date.now() - 300000 },
        { id: "3", exchange: "binance", symbol: "BTC/USDT", participantType: "smart_whale", side: "buy", size: 3200000, price: 71900, timestamp: Date.now() - 600000 },
      ],
    };
  });

  app.get("/sme", async () => {
    return {
      sme: 1.47,
      smartPnl: 82300000,
      dumbPnl: -37100000,
      retailPnl: -18700000,
    };
  });
}
