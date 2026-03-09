import type { FastifyInstance } from "fastify";
import {
  getCandles,
  getTicker,
  getFundingRate,
  getOIHistory,
  getRetailLSRatio,
  getTopLSRatio,
  toBinanceSymbol,
  binanceFetch,
} from "../services/data-provider.js";

const BINANCE_API = "https://fapi.binance.com";

const TF_MAP: Record<string, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m",
  "1h": "1h", "4h": "4h", "1d": "1d",
};

export async function marketRoutes(app: FastifyInstance) {
  // Candles with data-provider fallback (Binance → CoinGecko anchor → simulation)
  app.get("/candles", async (request) => {
    const { symbol = "BTC/USDT", timeframe = "1h", limit = "500" } = request.query as {
      symbol?: string;
      timeframe?: string;
      limit?: string;
    };

    const interval = TF_MAP[timeframe] || "1h";
    const { candles, source } = await getCandles(symbol, interval, parseInt(limit));
    return { data: candles, source, symbol, timeframe };
  });

  // Ticker with data-provider fallback
  app.get("/ticker", async (request) => {
    const { symbol = "BTC/USDT" } = request.query as { symbol?: string };
    const ticker = await getTicker(symbol);
    return ticker;
  });

  // Funding rate with data-provider fallback
  app.get("/funding", async (request) => {
    const { symbol = "BTC/USDT" } = request.query as { symbol?: string };

    const data = await getFundingRate(symbol, 1);
    if (data.length > 0) {
      return {
        symbol,
        fundingRate: parseFloat(data[0].fundingRate),
        fundingTime: data[0].fundingTime,
      };
    }
    return { symbol, fundingRate: 0, fundingTime: 0 };
  });

  // Open interest (Binance → fallback 0)
  app.get("/oi", async (request) => {
    const { symbol = "BTC/USDT" } = request.query as { symbol?: string };

    const raw = await binanceFetch<{ openInterest: string }>(
      `${BINANCE_API}/fapi/v1/openInterest?symbol=${toBinanceSymbol(symbol)}`
    );
    return {
      symbol,
      openInterest: raw?.openInterest ? parseFloat(raw.openInterest) : 0,
    };
  });

  // Global long/short ratio with data-provider fallback
  app.get("/ls-ratio", async (request) => {
    const { symbol = "BTC/USDT", period = "1h" } = request.query as { symbol?: string; period?: string };

    const data = await getRetailLSRatio(symbol, period, 1);
    if (data.length > 0) {
      const d = data[0];
      return {
        symbol,
        longAccount: parseFloat(d.longAccount),
        shortAccount: parseFloat(d.shortAccount),
        longShortRatio: parseFloat(d.longShortRatio),
      };
    }
    return { symbol, longAccount: 0, shortAccount: 0, longShortRatio: 0 };
  });

  // Top trader long/short ratio with data-provider fallback
  app.get("/top-ls-ratio", async (request) => {
    const { symbol = "BTC/USDT", period = "1h" } = request.query as { symbol?: string; period?: string };

    const data = await getTopLSRatio(symbol, period, 1);
    if (data.length > 0) {
      const d = data[0];
      return {
        symbol,
        longAccount: parseFloat(d.longAccount),
        shortAccount: parseFloat(d.shortAccount),
        longShortRatio: parseFloat(d.longShortRatio),
      };
    }
    return { symbol, longAccount: 0, shortAccount: 0, longShortRatio: 0 };
  });
}
