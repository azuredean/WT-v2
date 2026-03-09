import type { FastifyInstance } from "fastify";
import { runBacktest, runBacktestWithScan, type BacktestConfig } from "../services/backtest-engine.js";
import { engineGet, enginePost } from "../services/engine-client.js";

export async function tradingRoutes(app: FastifyInstance) {
  /**
   * GET /positions
   * Returns current positions (placeholder -- requires exchange account integration).
   */
  app.get("/positions", async () => {
    const engineResp = await engineGet<{ positions: Array<unknown> }>("/api/v1/trading/positions");
    if (engineResp && Array.isArray(engineResp.positions)) {
      return engineResp;
    }
    return {
      positions: [],
      message: "Position tracking requires exchange API key configuration (Phase 6)",
    };
  });

  /**
   * GET /history
   * Fetch trade history from engine (fallback empty)
   */
  app.get("/history", async (request) => {
    const { limit = "50" } = request.query as { limit?: string };
    const l = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
    const engineResp = await engineGet<{ trades: Array<unknown> }>(`/api/v1/trading/history?limit=${l}`);
    if (engineResp && Array.isArray(engineResp.trades)) {
      return engineResp;
    }
    return { trades: [] };
  });

  /**
   * POST /close
   * Close one position by id (engine-backed if available)
   */
  app.post("/close", async (request) => {
    const payload = request.body as { positionId?: string; exitPrice?: number };
    if (!payload?.positionId) return { status: "bad_request", message: "positionId required" };
    const engineResp = await enginePost<{ status: string; realized_pnl?: number }>("/api/v1/trading/close", {
      position_id: payload.positionId,
      exit_price: payload.exitPrice,
    });
    if (engineResp?.status) return engineResp;
    return { status: "not_available" };
  });

  /**
   * POST /close-all
   * Close all positions
   */
  app.post("/close-all", async () => {
    const engineResp = await enginePost<{ status: string; closed?: number; total_realized_pnl?: number }>("/api/v1/trading/close-all", {});
    if (engineResp?.status) return engineResp;
    return { status: "not_available" };
  });

  /**
   * POST /order
   * Submit an order (placeholder -- requires exchange account integration).
   */
  app.post("/order", async (request) => {
    const payload = request.body as Record<string, unknown>;
    const engineResp = await enginePost<{ order_id?: string; status?: string }>("/api/v1/trading/order", {
      symbol: payload.symbol,
      side: payload.side,
      order_type: payload.type || payload.order_type || "market",
      quantity: payload.quantity,
      price: payload.price,
      leverage: payload.leverage,
      exchange: payload.exchange || "binance",
    });

    const usableEngineResp =
      !!engineResp?.order_id &&
      engineResp.order_id !== "placeholder" &&
      engineResp.status !== "not_implemented";

    if (usableEngineResp) {
      return { orderId: engineResp.order_id, status: engineResp.status || "accepted", source: "engine" };
    }

    return {
      orderId: `order_${Date.now()}`,
      status: "simulated",
      source: "bff-fallback",
      message: "Engine unavailable or not implemented; executed in local simulated mode",
    };
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
      const engineResp = await enginePost<{ job_id?: string; status?: string }>("/api/v1/backtest/run", {
        strategy_ids: config.enabledStrategies && config.enabledStrategies.length > 0 ? config.enabledStrategies : [
          "s1_whale_tracking",
          "s2_capital_concentration",
          "s3_funding_reversal",
          "s4_liquidity_grab",
          "s5_oi_divergence",
          "s6_retail_counter",
          "s7_stop_hunt",
          "s8_smart_money_edge",
        ],
        symbol: config.symbol,
        timeframe: config.timeframe,
        start_date: config.startDate || new Date(Date.now() - 86400000 * 30).toISOString(),
        end_date: config.endDate || new Date().toISOString(),
        initial_capital: config.initialCapital,
      });

      if (engineResp?.job_id) {
        const result = await engineGet<{ job_id: string; status: string; results: unknown }>(`/api/v1/backtest/${engineResp.job_id}/results`);
        if (result?.results) {
          return {
            source: "engine",
            jobId: engineResp.job_id,
            status: result.status,
            ...result.results,
          };
        }
      }

      const wantsScan = Boolean((body as any).scan);
      const result = wantsScan
        ? await runBacktestWithScan({
            ...(config as any),
            scan: true,
            entryThresholdRange: (body as any).entryThresholdRange,
            positionSizeRange: (body as any).positionSizeRange,
          })
        : await runBacktest(config);
      return result;
    } catch (err) {
      console.error("[Trading] Backtest error:", err);
      reply.status(500);
      return { error: String(err) };
    }
  });
}
