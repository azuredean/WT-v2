import type { FastifyInstance } from "fastify";
import {
  computeSignal,
  getSignalHistory,
  getStrategyConfigs,
  updateStrategyWeights,
  updateStrategyEnabled,
} from "../services/signal-engine.js";
import {
  detectFOMOCrowding,
  detectStopHunt,
  analyzeLiquidationFuel,
  detectLiquidityVacuum,
  detectOIDivergence,
  detectWyckoffPhase,
  analyzeMarketMicrostructure,
} from "../services/advanced-strategies.js";
import {
  calculateDataQualityScore,
  detectAnomalies,
  CircuitBreaker,
} from "../services/anomaly-detection.js";
import {
  getCoinGlassLiquidationHistory,
  getCoinGlassExchangeFlow,
} from "../services/coinglass-provider.js";
import {
  getGlassnodeExchangeBalance,
  getGlassnodeWhaleBalance,
} from "../services/glassnode-provider.js";

export async function signalRoutes(app: FastifyInstance) {
  /**
   * GET /current
   * Compute real-time fused signal from all 8 strategies.
   */
  app.get("/current", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    try {
      const signal = await computeSignal(symbol || "BTC/USDT");
      return signal;
    } catch (err) {
      console.error("[Signals] Error computing signal:", err);
      return {
        symbol: symbol || "BTC/USDT",
        direction: "neutral",
        strength: 0,
        confidence: 0,
        recommendedSize: 0,
        dataQualityScore: 0,
        strategies: [],
        timestamp: Date.now(),
        error: String(err),
      };
    }
  });

  /**
   * GET /strategies
   * Return strategy configurations (names, weights, enabled status).
   */
  app.get("/strategies", async () => {
    return { strategies: getStrategyConfigs() };
  });

  /**
   * POST /strategies/weights
   * Update strategy weights at runtime
   */
  app.post("/strategies/weights", async (request) => {
    const body = (request.body || {}) as { weights?: Record<string, number> };
    const updated = updateStrategyWeights(body.weights || {});
    return { success: true, weights: updated };
  });

  /**
   * POST /strategies/enabled
   * Enable/disable strategies at runtime
   */
  app.post("/strategies/enabled", async (request) => {
    const body = (request.body || {}) as { enabled?: Record<string, boolean> };
    const updated = updateStrategyEnabled(body.enabled || {});
    return { success: true, enabled: updated };
  });

  /**
   * GET /history
   * Return recent signal history (last 100 signals stored in memory).
   */
  app.get("/history", async (request) => {
    const { symbol, limit } = request.query as { symbol?: string; limit?: string };
    let history = getSignalHistory();

    // Filter by symbol if provided
    if (symbol) {
      history = history.filter((s) => s.symbol === symbol);
    }

    // Limit results
    const maxResults = limit ? parseInt(limit, 10) : 50;
    if (maxResults > 0 && history.length > maxResults) {
      history = history.slice(-maxResults);
    }

    return {
      signals: history,
      total: history.length,
    };
  });

  /**
   * GET /advanced/fomo
   * Detect FOMO crowding (S6 strategy detail)
   */
  app.get("/advanced/fomo", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    try {
      const result = await detectFOMOCrowding(symbol || "BTC/USDT");
      return result;
    } catch (err) {
      console.error("[Signals] Error detecting FOMO:", err);
      return { error: String(err) };
    }
  });

  /**
   * GET /advanced/stop-hunt
   * Detect stop hunt patterns (S7 strategy detail)
   */
  app.get("/advanced/stop-hunt", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    try {
      const result = await detectStopHunt(symbol || "BTC/USDT");
      return result;
    } catch (err) {
      console.error("[Signals] Error detecting stop hunt:", err);
      return { error: String(err) };
    }
  });

  /**
   * GET /advanced/liquidation
   * Analyze liquidation fuel and cascade events
   */
  app.get("/advanced/liquidation", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    try {
      const sym = symbol || "BTC/USDT";
      const result = await analyzeLiquidationFuel(sym);
      return result;
    } catch (err) {
      console.error("[Signals] Error analyzing liquidation:", err);
      return { error: String(err) };
    }
  });

  /**
   * GET /external/coinglass
   * Coinglass free-tier data passthrough (requires API key)
   */
  app.get("/external/coinglass", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    const sym = symbol || "BTC/USDT";
    const [liquidation, netflow] = await Promise.all([
      getCoinGlassLiquidationHistory(sym),
      getCoinGlassExchangeFlow(sym),
    ]);
    return {
      symbol: sym,
      hasApiKey: !!process.env.COINGLASS_API_KEY,
      liquidation,
      netflow,
    };
  });

  /**
   * GET /external/glassnode
   * Glassnode free-tier data passthrough (requires API key)
   */
  app.get("/external/glassnode", async (request) => {
    const { asset = "BTC" } = request.query as { asset?: string };
    const [exchangeBalance, whaleBalance] = await Promise.all([
      getGlassnodeExchangeBalance(asset),
      getGlassnodeWhaleBalance(asset),
    ]);
    return {
      asset,
      hasApiKey: !!process.env.GLASSNODE_API_KEY,
      exchangeBalance,
      whaleBalance,
    };
  });

  /**
   * GET /advanced/liquidity-vacuum
   * Detect liquidity vacuum (market maker retreat)
   */
  app.get("/advanced/liquidity-vacuum", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    try {
      const result = await detectLiquidityVacuum(symbol || "BTC/USDT");
      return result;
    } catch (err) {
      console.error("[Signals] Error detecting liquidity vacuum:", err);
      return { error: String(err) };
    }
  });

  /**
   * GET /advanced/oi-divergence
   * Detect OI vs price divergence (6 scenarios)
   */
  app.get("/advanced/oi-divergence", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    try {
      const result = await detectOIDivergence(symbol || "BTC/USDT");
      return result;
    } catch (err) {
      console.error("[Signals] Error detecting OI divergence:", err);
      return { error: String(err) };
    }
  });

  /**
   * GET /advanced/wyckoff
   * Detect Wyckoff accumulation/distribution phase
   */
  app.get("/advanced/wyckoff", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    try {
      const result = await detectWyckoffPhase(symbol || "BTC/USDT");
      return result;
    } catch (err) {
      console.error("[Signals] Error detecting Wyckoff phase:", err);
      return { error: String(err) };
    }
  });

  /**
   * GET /advanced/microstructure
   * Analyze market microstructure (CVD, orderbook asymmetry, large trades)
   */
  app.get("/advanced/microstructure", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    try {
      const result = await analyzeMarketMicrostructure(symbol || "BTC/USDT");
      return result;
    } catch (err) {
      console.error("[Signals] Error analyzing microstructure:", err);
      return { error: String(err) };
    }
  });

  /**
   * GET /quality
   * Get data quality score (DQS)
   */
  app.get("/quality", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    try {
      const result = await calculateDataQualityScore(symbol || "BTC/USDT");
      return result;
    } catch (err) {
      console.error("[Signals] Error calculating DQS:", err);
      return { error: String(err) };
    }
  });

  /**
   * GET /anomalies
   * Detect anomalies (3-layer detection)
   */
  app.get("/anomalies", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    try {
      const result = await detectAnomalies(symbol || "BTC/USDT");
      return { anomalies: result, count: result.length };
    } catch (err) {
      console.error("[Signals] Error detecting anomalies:", err);
      return { error: String(err) };
    }
  });

  /**
   * GET /circuit-breaker
   * Check circuit breaker status
   */
  app.get("/circuit-breaker", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    try {
      const result = await CircuitBreaker.check(symbol || "BTC/USDT");
      return result;
    } catch (err) {
      console.error("[Signals] Error checking circuit breaker:", err);
      return { error: String(err) };
    }
  });

  /**
   * POST /circuit-breaker/reset
   * Reset circuit breaker for a symbol
   */
  app.post("/circuit-breaker/reset", async (request) => {
    const { symbol } = request.body as { symbol?: string };
    try {
      CircuitBreaker.reset(symbol || "BTC/USDT");
      return { success: true, message: `Circuit breaker reset for ${symbol || "BTC/USDT"}` };
    } catch (err) {
      console.error("[Signals] Error resetting circuit breaker:", err);
      return { error: String(err) };
    }
  });
}
