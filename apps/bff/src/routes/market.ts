import type { FastifyInstance } from "fastify";
import { ENGINE_URL } from "../index.js";

export async function marketRoutes(app: FastifyInstance) {
  // Proxy candles request to Python engine
  app.get("/candles", async (request, reply) => {
    const { symbol, timeframe, limit } = request.query as {
      symbol?: string;
      timeframe?: string;
      limit?: string;
    };

    try {
      const params = new URLSearchParams();
      if (symbol) params.set("symbol", symbol);
      if (timeframe) params.set("timeframe", timeframe);
      if (limit) params.set("limit", limit);

      const res = await fetch(`${ENGINE_URL}/api/v1/market/candles?${params}`);
      const data = await res.json();
      return data;
    } catch {
      // Return demo data if engine is not running
      return generateDemoCandles(500);
    }
  });

  // Proxy ticker
  app.get("/ticker", async (request) => {
    const { symbol } = request.query as { symbol?: string };

    try {
      const res = await fetch(
        `${ENGINE_URL}/api/v1/market/ticker?symbol=${encodeURIComponent(symbol || "BTC/USDT")}`
      );
      return await res.json();
    } catch {
      return { price: 72192, change24h: 2.35, volume24h: 28500000000 };
    }
  });
}

function generateDemoCandles(count: number) {
  const now = Date.now();
  const interval = 3600 * 1000;
  const data = [];
  let price = 68000;

  for (let i = count; i >= 0; i--) {
    const change = (Math.random() - 0.48) * 500;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 300;
    const low = Math.min(open, close) - Math.random() * 300;
    const volume = 100 + Math.random() * 2000;

    data.push({
      time: now - i * interval,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: +volume.toFixed(2),
    });

    price = close;
  }

  return { data };
}
