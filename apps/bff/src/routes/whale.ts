import type { FastifyInstance } from "fastify";
import {
  getParticipantProfiles,
  detectWhaleActivity,
  calculateSME,
  detectWhales,
} from "../services/whale-detector.js";

export async function whaleRoutes(app: FastifyInstance) {
  /**
   * GET /profiles
   * Return estimated participant profiles from real trade data.
   * Enhanced with 5-type classification: Smart Whale, Dumb Whale, Market Maker, Retail Herd, Arbitrageur
   */
  app.get("/profiles", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    try {
      const profiles = await getParticipantProfiles(symbol || "BTC/USDT");
      return { profiles };
    } catch (err) {
      console.error("[Whale] Error fetching profiles:", err);
      return { profiles: [], error: String(err) };
    }
  });

  /**
   * GET /activity
   * Return recent large trade (whale) activity from Binance aggregated trades.
   */
  app.get("/activity", async (request) => {
    const { symbol, limit } = request.query as { symbol?: string; limit?: string };
    try {
      let activities = await detectWhaleActivity(symbol || "BTC/USDT");

      // Limit results
      const maxResults = limit ? parseInt(limit, 10) : 50;
      if (maxResults > 0 && activities.length > maxResults) {
        activities = activities.slice(0, maxResults);
      }

      return { activities };
    } catch (err) {
      console.error("[Whale] Error detecting activity:", err);
      return { activities: [], error: String(err) };
    }
  });

  /**
   * GET /sme
   * Return the Smart Money Edge index and PnL breakdown.
   * SME > 1.0 = smart money winning, < 1.0 = dumb money winning
   */
  app.get("/sme", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    try {
      const sme = await calculateSME(symbol || "BTC/USDT");
      return sme;
    } catch (err) {
      console.error("[Whale] Error calculating SME:", err);
      return { sme: 1.0, smartPnl: 0, dumbPnl: 0, retailPnl: 0, error: String(err) };
    }
  });

  /**
   * GET /full-analysis
   * Return complete whale detection result: activities + profiles + SME
   */
  app.get("/full-analysis", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    try {
      const result = await detectWhales(symbol || "BTC/USDT");
      return result;
    } catch (err) {
      console.error("[Whale] Error in full analysis:", err);
      return { 
        activities: [], 
        profiles: [], 
        sme: { sme: 1.0, smartPnl: 0, dumbPnl: 0, retailPnl: 0 },
        error: String(err) 
      };
    }
  });
}
