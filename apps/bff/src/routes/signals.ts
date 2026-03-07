import type { FastifyInstance } from "fastify";

export async function signalRoutes(app: FastifyInstance) {
  app.get("/current", async (request) => {
    const { symbol } = request.query as { symbol?: string };
    // Placeholder - will proxy to Python engine in Phase 3
    return {
      symbol: symbol || "BTC/USDT",
      direction: "long",
      strength: 0.72,
      confidence: 0.85,
      recommendedSize: 3.2,
      dataQualityScore: 0.94,
      strategies: [
        { id: "s1_whale_tracking", direction: "long", strength: 0.8 },
        { id: "s2_capital_concentration", direction: "long", strength: 0.7 },
        { id: "s3_funding_reversal", direction: "long", strength: 0.3 },
        { id: "s6_retail_counter", direction: "long", strength: 0.6 },
        { id: "s7_stop_hunt", direction: "long", strength: 0.5 },
        { id: "s8_smart_money_edge", direction: "long", strength: 0.8 },
      ],
      timestamp: Date.now(),
    };
  });

  app.get("/strategies", async () => {
    return {
      strategies: [
        { id: "s1_whale_tracking", name: "巨鲸跟单", description: "跟踪聊明鲸仓位方向", enabled: true },
        { id: "s2_capital_concentration", name: "资金集中", description: "检测资金流向集中度", enabled: true },
        { id: "s3_funding_reversal", name: "资金费反转", description: "资金费率极端后反转", enabled: true },
        { id: "s4_liquidity_grab", name: "流动性抓取", description: "清算级联后建仓机会", enabled: true },
        { id: "s5_oi_divergence", name: "OI背离", description: "持仓量与价格背离", enabled: true },
        { id: "s6_retail_counter", name: "散户反向", description: "散户多空比极端时反向", enabled: true },
        { id: "s7_stop_hunt", name: "止损猎杀", description: "检测止损猎杀模式", enabled: true },
        { id: "s8_smart_money_edge", name: "聊明钱优势", description: "SME指数判断方向", enabled: true },
      ],
    };
  });
}
