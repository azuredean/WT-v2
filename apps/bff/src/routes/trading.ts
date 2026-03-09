import type { FastifyInstance } from "fastify";
import { runBacktest, type BacktestConfig } from "../services/backtest-engine.js";

export async function tradingRoutes(app: FastifyInstance) {
  /**
   * GET /positions
   * Returns current positions (placeholder -- requires exchange account integration).
   */
  app.get("/positions", async () => {
    return {
      positions: [],
      message: "Position tracking requires exchange API key configuration (Phase 6)",
    };
  });

  /**
   * POST /order
   * Submit an order (placeholder -- requires exchange account integration).
   */
  app.post("/order", async (request) => {
    return { orderId: `order_${Date.now()}`, status: "received", message: "Order execution requires exchange API key (Phase 6)" };
  });

  /**
   * POST /backtest
   * Run a backtest using historical Binance candle data and the signal engine.
   *
   * Request body:
   * {
   *   symbol: "BTC/USDT",       // trading pair
   *   timeframe: "1h",          // candle interval
   *   candleCount: 500,         // number of historical candles
   *   initialCapital: 10000,    // starting capital in USDT
   *   entryThreshold: 0.3,      // signal strength to open position (0-1)
   *   positionSizeFraction: 0.5,// fraction of capital per trade
   *   maxLeverage: 3,           // maximum leverage
   *   stopLoss: 0.03,           // stop loss % (3%)
   *   takeProfit: 0.06,         // take profit % (6%)
   *   enabledStrategies: []     // strategy IDs to enable (empty = all)
   * }
   */
  app.post("/backtest", async (request, reply) => {
    const body = request.body as Partial<BacktestConfig> | undefined;

    if (!body) {
      reply.status(400);
      return { error: "Request body is required" };
    }

    const config: BacktestConfig = {
      symbol: body.symbol || "BTC/USDT",
      timeframe: body.timeframe || "1h",
      candleCount: body.candleCount || 500,
      initialCapital: body.initialCapital || 10000,
      entryThreshold: body.entryThreshold ?? 0.3,
      positionSizeFraction: body.positionSizeFraction ?? 0.5,
      maxLeverage: body.maxLeverage ?? 3,
      stopLoss: body.stopLoss ?? 0.03,
      takeProfit: body.takeProfit ?? 0.06,
      enabledStrategies: body.enabledStrategies ?? [],
      startDate: body.startDate,
      endDate: body.endDate,
    };

    try {
      const result = await runBacktest(config);
      return result;
    } catch (err) {
      console.error("[Trading] Backtest error:", err);
      reply.status(500);
      return { error: String(err) };
    }
  });
}
