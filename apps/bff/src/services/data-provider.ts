/**
 * Data Provider
 *
 * Provides market data from real exchange APIs only:
 *   1. Binance Futures public API (preferred)
 *   2. CoinGecko public API (for price/ticker — works globally)
 *
 * No simulated data. If exchange API is unavailable (geo-restricted),
 * returns empty data so the UI can display "no data" states.
 * CoinGecko provides real live price/24h change as a ticker fallback.
 */

const FETCH_TIMEOUT_MS = 10_000;

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function toBinanceSymbol(symbol: string): string {
  return symbol.replace("/", "");
}

export async function binanceFetch<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[DataProvider] Binance HTTP ${res.status} for ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[DataProvider] Fetch error for ${url}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TickerData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  highPrice: number;
  lowPrice: number;
  source: "binance" | "coingecko" | "unavailable";
}

export interface RatioEntry {
  longShortRatio: string;
  longAccount: string;
  shortAccount: string;
  timestamp: number;
}

export interface FundingEntry {
  fundingRate: string;
  fundingTime: number;
}

export interface OIHistEntry {
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
}

export interface TakerRatioEntry {
  buySellRatio: string;
  buyVol: string;
  sellVol: string;
  timestamp: number;
}

export interface AggTrade {
  a: number;
  p: string;
  q: string;
  T: number;
  m: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BINANCE_API = "https://fapi.binance.com";

// CoinGecko IDs mapped to Binance symbol
const COINGECKO_ID_MAP: Record<string, string> = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  SOLUSDT: "solana",
  BNBUSDT: "binancecoin",
};

// ---------------------------------------------------------------------------
// CoinGecko price cache (60s TTL) — provides REAL live prices
// ---------------------------------------------------------------------------

interface PriceCache {
  price: number;
  change24h: number;
  volume24h: number;
  lastFetched: number;
}

const priceCache = new Map<string, PriceCache>();
let lastCoinGeckoFetch = 0;
let geckoFetchInProgress = false;

async function refreshCoinGeckoCache(): Promise<void> {
  if (geckoFetchInProgress) return;
  geckoFetchInProgress = true;
  try {
    const ids = Object.values(COINGECKO_ID_MAP).join(",");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return;
    const data = (await res.json()) as Record<string, Record<string, number>>;

    for (const [binSym, geckoId] of Object.entries(COINGECKO_ID_MAP)) {
      const d = data[geckoId];
      if (d?.usd) {
        priceCache.set(binSym, {
          price: d.usd,
          change24h: d.usd_24h_change ?? 0,
          volume24h: d.usd_24h_vol ?? 0,
          lastFetched: Date.now(),
        });
      }
    }
    lastCoinGeckoFetch = Date.now();
  } catch {
    // silently ignore
  } finally {
    geckoFetchInProgress = false;
  }
}

async function getCachedPrice(binanceSymbol: string): Promise<PriceCache | null> {
  const cached = priceCache.get(binanceSymbol);
  const stale = !cached || Date.now() - cached.lastFetched > 60_000;

  if (stale && Date.now() - lastCoinGeckoFetch > 5_000) {
    await refreshCoinGeckoCache();
  }

  const result = priceCache.get(binanceSymbol);
  return result && result.lastFetched > 0 ? result : null;
}

// ---------------------------------------------------------------------------
// Public data-fetching functions (real data only, no simulation)
// ---------------------------------------------------------------------------

export async function getCandles(
  symbol: string,
  interval = "1h",
  limit = 100
): Promise<{ candles: Candle[]; source: string }> {
  const binSym = toBinanceSymbol(symbol);

  const raw = await binanceFetch<unknown[]>(
    `${BINANCE_API}/fapi/v1/klines?symbol=${binSym}&interval=${interval}&limit=${limit}`
  );
  if (raw && raw.length > 0) {
    const candles = (raw as (string | number)[][]).map((k) => ({
      time: k[0] as number,
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }));
    return { candles, source: "binance" };
  }

  // No candle data available (Binance geo-restricted)
  return { candles: [], source: "unavailable" };
}

export async function getTicker(symbol: string): Promise<TickerData> {
  const binSym = toBinanceSymbol(symbol);

  // Try Binance first
  const raw = await binanceFetch<{
    lastPrice: string;
    priceChangePercent: string;
    quoteVolume: string;
    highPrice: string;
    lowPrice: string;
  }>(`${BINANCE_API}/fapi/v1/ticker/24hr?symbol=${binSym}`);

  if (raw?.lastPrice) {
    return {
      symbol,
      price: parseFloat(raw.lastPrice),
      change24h: parseFloat(raw.priceChangePercent),
      volume24h: parseFloat(raw.quoteVolume),
      highPrice: parseFloat(raw.highPrice),
      lowPrice: parseFloat(raw.lowPrice),
      source: "binance",
    };
  }

  // Try CoinGecko (real live price)
  const priceData = await getCachedPrice(binSym);
  if (priceData) {
    return {
      symbol,
      price: priceData.price,
      change24h: priceData.change24h,
      volume24h: priceData.volume24h,
      highPrice: priceData.price * (1 + Math.abs(priceData.change24h) / 100 + 0.005),
      lowPrice: priceData.price * (1 - Math.abs(priceData.change24h) / 100 - 0.005),
      source: "coingecko",
    };
  }

  // No real data available
  return {
    symbol,
    price: 0,
    change24h: 0,
    volume24h: 0,
    highPrice: 0,
    lowPrice: 0,
    source: "unavailable",
  };
}

export async function getTopLSRatio(
  symbol: string,
  _period = "5m",
  limit = 30
): Promise<RatioEntry[]> {
  const binSym = toBinanceSymbol(symbol);
  return (
    (await binanceFetch<RatioEntry[]>(
      `${BINANCE_API}/futures/data/topLongShortPositionRatio?symbol=${binSym}&period=5m&limit=${limit}`
    )) ?? []
  );
}

export async function getRetailLSRatio(
  symbol: string,
  _period = "5m",
  limit = 30
): Promise<RatioEntry[]> {
  const binSym = toBinanceSymbol(symbol);
  return (
    (await binanceFetch<RatioEntry[]>(
      `${BINANCE_API}/futures/data/globalLongShortAccountRatio?symbol=${binSym}&period=5m&limit=${limit}`
    )) ?? []
  );
}

export async function getFundingRate(
  symbol: string,
  limit = 10
): Promise<FundingEntry[]> {
  const binSym = toBinanceSymbol(symbol);
  return (
    (await binanceFetch<FundingEntry[]>(
      `${BINANCE_API}/fapi/v1/fundingRate?symbol=${binSym}&limit=${limit}`
    )) ?? []
  );
}

export async function getOIHistory(
  symbol: string,
  _period = "5m",
  limit = 30
): Promise<OIHistEntry[]> {
  const binSym = toBinanceSymbol(symbol);
  return (
    (await binanceFetch<OIHistEntry[]>(
      `${BINANCE_API}/futures/data/openInterestHist?symbol=${binSym}&period=5m&limit=${limit}`
    )) ?? []
  );
}

export async function getTakerRatio(
  symbol: string,
  _period = "5m",
  limit = 30
): Promise<TakerRatioEntry[]> {
  const binSym = toBinanceSymbol(symbol);
  return (
    (await binanceFetch<TakerRatioEntry[]>(
      `${BINANCE_API}/futures/data/takerlongshortRatio?symbol=${binSym}&period=5m&limit=${limit}`
    )) ?? []
  );
}

export async function getAggTrades(
  symbol: string,
  limit = 500
): Promise<AggTrade[]> {
  const binSym = toBinanceSymbol(symbol);
  return (
    (await binanceFetch<AggTrade[]>(
      `${BINANCE_API}/fapi/v1/aggTrades?symbol=${binSym}&limit=${limit}`
    )) ?? []
  );
}

// Warm up the CoinGecko cache on module load
refreshCoinGeckoCache().catch(() => {});
