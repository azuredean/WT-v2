import type { FastifyInstance } from "fastify";

// Binance public API — no API key required for market data
const BINANCE_API = "https://fapi.binance.com";

// Map our timeframes to Binance interval format
const TF_MAP: Record<string, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m",
  "1h": "1h", "4h": "4h", "1d": "1d",
};

// Map our symbol format (BTC/USDT) to Binance format (BTCUSDT)
function toBinanceSymbol(symbol: string): string {
  return symbol.replace("/", "");
}

export async function marketRoutes(app: FastifyInstance) {
  // Real Binance candles
  app.get("/candles", async (request) => {
    const { symbol = "BTC/USDT", timeframe = "1h", limit = "500" } = request.query as {
      symbol?: string;
      timeframe?: string;
      limit?: string;
    };

    try {
      const binanceSymbol = toBinanceSymbol(symbol);
      const interval = TF_MAP[timeframe] || "1h";
      const url = `${BINANCE_API}/fapi/v1/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Binance API error: ${res.status}`);

      const raw = await res.json() as number[][];

      // Binance kline format: [openTime, open, high, low, close, volume, closeTime, ...]
      const data = raw.map((k) => ({
        time: k[0] as number,         // open time in ms
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
      }));

      return { data, source: "binance", symbol, timeframe };
    } catch (err) {
      console.error("[Market] Binance candles error:", err);
      return { data: [], source: "error", error: String(err) };
    }
  });

  // Real Binance ticker
  app.get("/ticker", async (request) => {
    const { symbol = "BTC/USDT" } = request.query as { symbol?: string };

    try {
      const binanceSymbol = toBinanceSymbol(symbol);
      const res = await fetch(`${BINANCE_API}/fapi/v1/ticker/24hr?symbol=${binanceSymbol}`);
      if (!res.ok) throw new Error(`Binance ticker error: ${res.status}`);

      const t = await res.json() as Record<string, string>;
      return {
        symbol,
        price: parseFloat(t.lastPrice),
        change24h: parseFloat(t.priceChangePercent),
        volume24h: parseFloat(t.quoteVolume),
      };
    } catch (err) {
      console.error("[Market] Binance ticker error:", err);
      return { symbol, price: 0, change24h: 0, volume24h: 0 };
    }
  });

  // Real Binance funding rate
  app.get("/funding", async (request) => {
    const { symbol = "BTC/USDT" } = request.query as { symbol?: string };

    try {
      const binanceSymbol = toBinanceSymbol(symbol);
      const res = await fetch(`${BINANCE_API}/fapi/v1/fundingRate?symbol=${binanceSymbol}&limit=1`);
      const data = await res.json() as Record<string, string>[];
      return {
        symbol,
        fundingRate: data.length > 0 ? parseFloat(data[0].fundingRate) : 0,
        fundingTime: data.length > 0 ? parseInt(data[0].fundingTime) : 0,
      };
    } catch {
      return { symbol, fundingRate: 0, fundingTime: 0 };
    }
  });

  // Real Binance open interest
  app.get("/oi", async (request) => {
    const { symbol = "BTC/USDT" } = request.query as { symbol?: string };

    try {
      const binanceSymbol = toBinanceSymbol(symbol);
      const res = await fetch(`${BINANCE_API}/fapi/v1/openInterest?symbol=${binanceSymbol}`);
      const data = await res.json() as Record<string, string>;
      return {
        symbol,
        openInterest: parseFloat(data.openInterest),
      };
    } catch {
      return { symbol, openInterest: 0 };
    }
  });

  // Real Binance long/short ratio
  app.get("/ls-ratio", async (request) => {
    const { symbol = "BTC/USDT", period = "1h" } = request.query as { symbol?: string; period?: string };

    try {
      const binanceSymbol = toBinanceSymbol(symbol);
      const res = await fetch(
        `${BINANCE_API}/futures/data/globalLongShortAccountRatio?symbol=${binanceSymbol}&period=${period}&limit=1`
      );
      const data = await res.json() as Record<string, string>[];
      return {
        symbol,
        longAccount: data.length > 0 ? parseFloat(data[0].longAccount) : 0,
        shortAccount: data.length > 0 ? parseFloat(data[0].shortAccount) : 0,
        longShortRatio: data.length > 0 ? parseFloat(data[0].longShortRatio) : 0,
      };
    } catch {
      return { symbol, longAccount: 0, shortAccount: 0, longShortRatio: 0 };
    }
  });

  // Real Binance top trader long/short ratio
  app.get("/top-ls-ratio", async (request) => {
    const { symbol = "BTC/USDT", period = "1h" } = request.query as { symbol?: string; period?: string };

    try {
      const binanceSymbol = toBinanceSymbol(symbol);
      const res = await fetch(
        `${BINANCE_API}/futures/data/topLongShortPositionRatio?symbol=${binanceSymbol}&period=${period}&limit=1`
      );
      const data = await res.json() as Record<string, string>[];
      return {
        symbol,
        longAccount: data.length > 0 ? parseFloat(data[0].longAccount) : 0,
        shortAccount: data.length > 0 ? parseFloat(data[0].shortAccount) : 0,
        longShortRatio: data.length > 0 ? parseFloat(data[0].longShortRatio) : 0,
      };
    } catch {
      return { symbol, longAccount: 0, shortAccount: 0, longShortRatio: 0 };
    }
  });
}
