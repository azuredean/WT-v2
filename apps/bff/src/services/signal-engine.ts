/**
 * Signal Calculation Engine
 *
 * Computes 8 trading strategies from real Binance Futures public API data.
 * Each strategy returns a direction (long/short/neutral), strength (-1 to 1),
 * and confidence (0-1). The engine fuses all strategies into a single signal
 * using a weighted average.
 *
 * No API keys required -- all endpoints are publicly accessible.
 * Data is sourced via data-provider (Binance → CoinGecko → simulation fallback).
 */

import {
  getCandles,
  getTicker,
  getTopLSRatio,
  getRetailLSRatio,
  getFundingRate,
  getOIHistory,
  getTakerRatio,
  getAggTrades,
  toBinanceSymbol,
  binanceFetch,
  type Candle,
  type RatioEntry,
  type FundingEntry,
  type OIHistEntry,
  type TakerRatioEntry,
  type AggTrade,
  type TickerData,
} from "./data-provider.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Direction = "long" | "short" | "neutral";

export interface StrategyResult {
  id: string;
  name: string;
  direction: Direction;
  /** -1 (max short) to 1 (max long) */
  strength: number;
  /** 0 (no confidence) to 1 (full confidence) */
  confidence: number;
  /** Human-readable reason */
  reason: string;
}

export interface FusedSignal {
  symbol: string;
  direction: Direction;
  /** -1 to 1 */
  strength: number;
  confidence: number;
  recommendedSize: number;
  dataQualityScore: number;
  strategies: StrategyResult[];
  timestamp: number;
}

/** Re-export Candle from data-provider */
export type { Candle };

// ---------------------------------------------------------------------------
// Thin fetch wrappers — strategy implementations remain unchanged
// ---------------------------------------------------------------------------

async function fetchCandles(
  symbol: string,
  interval: string = "1h",
  limit: number = 100,
): Promise<Candle[]> {
  const { candles } = await getCandles(symbol, interval, limit);
  return candles;
}

async function fetchTopLSRatio(s: string, p = "5m", l = 30): Promise<RatioEntry[]> {
  return getTopLSRatio(s, p, l);
}

async function fetchRetailLSRatio(s: string, p = "5m", l = 30): Promise<RatioEntry[]> {
  return getRetailLSRatio(s, p, l);
}

async function fetchFundingRate(s: string, l = 10): Promise<FundingEntry[]> {
  return getFundingRate(s, l);
}

async function fetchOIHistory(s: string, p = "5m", l = 30): Promise<OIHistEntry[]> {
  return getOIHistory(s, p, l);
}

async function fetchTakerRatio(s: string, p = "5m", l = 30): Promise<TakerRatioEntry[]> {
  return getTakerRatio(s, p, l);
}

async function fetchAggTrades(s: string, l = 500): Promise<AggTrade[]> {
  return getAggTrades(s, l);
}

async function fetchTicker(s: string): Promise<TickerData> {
  return getTicker(s);
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function directionFromStrength(s: number): Direction {
  if (s > 0.05) return "long";
  if (s < -0.05) return "short";
  return "neutral";
}

// ---------------------------------------------------------------------------
// Strategy implementations
// ---------------------------------------------------------------------------

/**
 * S1 -- Whale Tracking
 * Compare top trader long/short ratio vs retail. If top traders are
 * significantly more long than retail, generate a long signal.
 */
async function s1WhaleTracking(symbol: string): Promise<StrategyResult> {
  const id = "s1_whale_tracking";
  const name = "Whale Tracking";

  const [topData, retailData] = await Promise.all([
    fetchTopLSRatio(symbol, "5m", 10),
    fetchRetailLSRatio(symbol, "5m", 10),
  ]);

  if (topData.length === 0 || retailData.length === 0) {
    return { id, name, direction: "neutral", strength: 0, confidence: 0, reason: "Insufficient data" };
  }

  const topRatio = parseFloat(topData[topData.length - 1].longShortRatio);
  const retailRatio = parseFloat(retailData[retailData.length - 1].longShortRatio);

  // Divergence: how much more bullish are top traders vs retail?
  const diff = topRatio - retailRatio;

  // Normalize: a diff of 0.3 maps to strength = 1.0
  const rawStrength = clamp(diff / 0.3, -1, 1);
  const strength = Math.round(rawStrength * 100) / 100;

  const topAvg =
    topData.reduce((acc, d) => acc + parseFloat(d.longShortRatio), 0) / topData.length;
  const topLatest = topRatio;
  const trendConsistency = 1 - Math.abs(topLatest - topAvg) / Math.max(topAvg, 0.01);
  const confidence = clamp(Math.abs(rawStrength) * trendConsistency, 0, 1);

  const direction = directionFromStrength(strength);
  const reason =
    direction === "neutral"
      ? "Top traders and retail are in agreement"
      : `Top trader ratio ${topRatio.toFixed(3)} vs retail ${retailRatio.toFixed(3)} (diff ${diff > 0 ? "+" : ""}${diff.toFixed(3)})`;

  return { id, name, direction, strength, confidence: Math.round(confidence * 100) / 100, reason };
}

/**
 * S2 -- Capital Concentration
 * Analyze taker buy/sell volume ratio. Persistent buy-side pressure = long.
 */
async function s2CapitalConcentration(symbol: string): Promise<StrategyResult> {
  const id = "s2_capital_concentration";
  const name = "Capital Concentration";

  const takerData = await fetchTakerRatio(symbol, "5m", 30);
  if (takerData.length < 5) {
    return { id, name, direction: "neutral", strength: 0, confidence: 0, reason: "Insufficient taker data" };
  }

  const recentRatios = takerData.slice(-10).map((d) => parseFloat(d.buySellRatio));
  const avgRatio = recentRatios.reduce((a, b) => a + b, 0) / recentRatios.length;

  const rawStrength = clamp((avgRatio - 1) / 0.2, -1, 1);
  const strength = Math.round(rawStrength * 100) / 100;

  const increasing = recentRatios.filter((_, i) => i > 0 && recentRatios[i] >= recentRatios[i - 1]).length;
  const trendScore = increasing / (recentRatios.length - 1);
  const confidence = clamp(Math.abs(rawStrength) * (0.5 + trendScore * 0.5), 0, 1);

  const direction = directionFromStrength(strength);
  const reason =
    direction === "neutral"
      ? "Taker buy/sell ratio balanced"
      : `Avg taker buy/sell ratio: ${avgRatio.toFixed(3)} (${direction === "long" ? "buy" : "sell"} pressure)`;

  return { id, name, direction, strength, confidence: Math.round(confidence * 100) / 100, reason };
}

/**
 * S3 -- Funding Reversal
 * Extreme positive funding rate (>0.03%) => expect short squeeze / reversal -> short signal
 * Extreme negative (<-0.03%) => expect long squeeze / reversal -> long signal
 */
async function s3FundingReversal(symbol: string): Promise<StrategyResult> {
  const id = "s3_funding_reversal";
  const name = "Funding Reversal";

  const fundingData = await fetchFundingRate(symbol, 10);
  if (fundingData.length === 0) {
    return { id, name, direction: "neutral", strength: 0, confidence: 0, reason: "No funding rate data" };
  }

  const latestRate = parseFloat(fundingData[0].fundingRate);

  const threshold = 0.0003;
  const extremeThreshold = 0.001;

  let rawStrength = 0;
  if (Math.abs(latestRate) > threshold) {
    rawStrength = clamp(-latestRate / extremeThreshold, -1, 1);
  }
  const strength = Math.round(rawStrength * 100) / 100;

  const extremeness = Math.abs(latestRate) / extremeThreshold;
  const avgFunding =
    fundingData.reduce((acc, d) => acc + Math.abs(parseFloat(d.fundingRate)), 0) / fundingData.length;
  const persistenceBonus = avgFunding > threshold ? 0.2 : 0;
  const confidence = clamp(extremeness * 0.8 + persistenceBonus, 0, 1);

  const direction = directionFromStrength(strength);
  const reason =
    direction === "neutral"
      ? `Funding rate ${(latestRate * 100).toFixed(4)}% within normal range`
      : `Funding rate ${(latestRate * 100).toFixed(4)}% is extreme -> reversal expected`;

  return { id, name, direction, strength, confidence: Math.round(confidence * 100) / 100, reason };
}

/**
 * S4 -- Liquidity Grab
 * Detect liquidation cascades via volume spikes followed by stabilization.
 */
async function s4LiquidityGrab(symbol: string): Promise<StrategyResult> {
  const id = "s4_liquidity_grab";
  const name = "Liquidity Grab";

  const candles = await fetchCandles(symbol, "5m", 60);
  if (candles.length < 30) {
    return { id, name, direction: "neutral", strength: 0, confidence: 0, reason: "Insufficient candle data" };
  }

  const volumes = candles.map((c) => c.volume);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

  const recentCandles = candles.slice(-10);
  const olderCandles = candles.slice(-20, -10);

  let spikeCandle: Candle | null = null;
  let spikeIndex = -1;
  for (let i = 0; i < recentCandles.length - 2; i++) {
    if (recentCandles[i].volume > avgVolume * 3) {
      spikeCandle = recentCandles[i];
      spikeIndex = i;
      break;
    }
  }

  if (!spikeCandle || spikeIndex < 0) {
    return { id, name, direction: "neutral", strength: 0, confidence: 0, reason: "No recent liquidation cascade detected" };
  }

  const afterSpike = recentCandles.slice(spikeIndex + 1);
  if (afterSpike.length < 2) {
    return { id, name, direction: "neutral", strength: 0, confidence: 0.1, reason: "Spike too recent to evaluate stabilization" };
  }

  const afterRanges = afterSpike.map((c) => (c.high - c.low) / c.close);
  const avgAfterRange = afterRanges.reduce((a, b) => a + b, 0) / afterRanges.length;
  const olderRanges = olderCandles.map((c) => (c.high - c.low) / c.close);
  const avgOlderRange = olderRanges.reduce((a, b) => a + b, 0) / olderRanges.length;

  const stabilized = avgAfterRange < avgOlderRange * 1.2;

  if (!stabilized) {
    return { id, name, direction: "neutral", strength: 0, confidence: 0.2, reason: "Volume spike detected but price not stabilized" };
  }

  const spikeBearish = spikeCandle.close < spikeCandle.open;
  const rawStrength = spikeBearish ? 0.6 : -0.6;

  const spikeMagnitude = clamp(spikeCandle.volume / (avgVolume * 3), 0.5, 2);
  const strength = Math.round(clamp(rawStrength * spikeMagnitude, -1, 1) * 100) / 100;

  const confidence = clamp(0.5 + (spikeMagnitude - 1) * 0.3, 0.3, 0.9);
  const direction = directionFromStrength(strength);

  return {
    id,
    name,
    direction,
    strength,
    confidence: Math.round(confidence * 100) / 100,
    reason: `Liquidation cascade detected (${spikeMagnitude.toFixed(1)}x avg volume), price stabilized -> ${direction} entry`,
  };
}

/**
 * S7 -- Stop Hunt (Enhanced Detection)
 * Detect stop hunt patterns:
 * 1. Long wick (>60% of range) near key levels
 * 2. Volume spike (>2x average)
 * 3. Quick recovery in next candle
 * Signal in reversal direction after stop hunt
 */
async function s7StopHunt(symbol: string): Promise<StrategyResult> {
  const id = "s7_stop_hunt";
  const name = "Stop Hunt";

  const candles = await fetchCandles(symbol, "5m", 60);
  if (candles.length < 30) {
    return { id, name, direction: "neutral", strength: 0, confidence: 0, reason: "Insufficient candle data" };
  }

  const avgVolume = candles.reduce((a, c) => a + c.volume, 0) / candles.length;

  const recentCandles = candles.slice(-10);
  let bestSignal = 0;
  let bestReason = "No stop hunt pattern detected";
  let bestConfidence = 0;

  // Check last few candles for stop hunt pattern
  for (let i = 0; i < recentCandles.length - 1; i++) {
    const candle = recentCandles[i];
    const nextCandle = recentCandles[i + 1];
    
    const totalRange = candle.high - candle.low;
    if (totalRange <= 0) continue;

    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;

    const upperWickRatio = upperWick / totalRange;
    const lowerWickRatio = lowerWick / totalRange;
    const volumeSpike = candle.volume / avgVolume;
    const hasVolumeSpike = volumeSpike > 2;

    // Bullish stop hunt: long lower wick + volume spike + next candle recovers
    if (lowerWickRatio > 0.6 && hasVolumeSpike) {
      const recovery = nextCandle.close > candle.open;
      const signal = clamp(lowerWickRatio * volumeSpike * 0.25, 0, 1);
      
      if (recovery && signal > Math.abs(bestSignal)) {
        bestSignal = signal;
        bestReason = `Bullish stop hunt: ${(lowerWickRatio * 100).toFixed(0)}% lower wick, ${volumeSpike.toFixed(1)}x volume, recovered -> LONG`;
        bestConfidence = clamp(signal * 0.9, 0, 0.95);
      }
    }
    
    // Bearish stop hunt: long upper wick + volume spike + next candle drops
    if (upperWickRatio > 0.6 && hasVolumeSpike) {
      const rejection = nextCandle.close < candle.open;
      const signal = -clamp(upperWickRatio * volumeSpike * 0.25, 0, 1);
      
      if (rejection && Math.abs(signal) > Math.abs(bestSignal)) {
        bestSignal = signal;
        bestReason = `Bearish stop hunt: ${(upperWickRatio * 100).toFixed(0)}% upper wick, ${volumeSpike.toFixed(1)}x volume, rejected -> SHORT`;
        bestConfidence = clamp(Math.abs(signal) * 0.9, 0, 0.95);
      }
    }
  }

  const strength = Math.round(bestSignal * 100) / 100;
  const direction = directionFromStrength(strength);

  return { id, name, direction, strength, confidence: Math.round(bestConfidence * 100) / 100, reason: bestReason };
}

/**
 * S5 -- OI Divergence
 * If price makes a new high but OI doesn't follow (or vice versa),
 * this is a divergence signal.
 */
async function s5OIDivergence(symbol: string): Promise<StrategyResult> {
  const id = "s5_oi_divergence";
  const name = "OI Divergence";

  const [candles, oiHist] = await Promise.all([
    fetchCandles(symbol, "5m", 30),
    fetchOIHistory(symbol, "5m", 30),
  ]);

  if (candles.length < 10 || oiHist.length < 10) {
    return { id, name, direction: "neutral", strength: 0, confidence: 0, reason: "Insufficient data for OI divergence" };
  }

  const recentCandles = candles.slice(-10);
  const olderCandles = candles.slice(-20, -10);
  const recentOI = oiHist.slice(-10);
  const olderOI = oiHist.slice(-20, -10);

  if (olderCandles.length === 0 || olderOI.length === 0) {
    return { id, name, direction: "neutral", strength: 0, confidence: 0, reason: "Insufficient historical data" };
  }

  const recentHigh = Math.max(...recentCandles.map((c) => c.high));
  const olderHigh = Math.max(...olderCandles.map((c) => c.high));
  const recentLow = Math.min(...recentCandles.map((c) => c.low));
  const olderLow = Math.min(...olderCandles.map((c) => c.low));

  const priceNewHigh = recentHigh > olderHigh;
  const priceNewLow = recentLow < olderLow;

  const recentOIAvg =
    recentOI.reduce((a, d) => a + parseFloat(d.sumOpenInterestValue), 0) / recentOI.length;
  const olderOIAvg =
    olderOI.reduce((a, d) => a + parseFloat(d.sumOpenInterestValue), 0) / olderOI.length;
  const oiRising = recentOIAvg > olderOIAvg * 1.02;
  const oiFalling = recentOIAvg < olderOIAvg * 0.98;

  let rawStrength = 0;
  let reason = "No divergence detected";

  if (priceNewHigh && !oiRising) {
    rawStrength = -0.5;
    reason = `Price making new highs but OI not following (OI change: ${(((recentOIAvg / olderOIAvg) - 1) * 100).toFixed(1)}%)`;
    if (oiFalling) {
      rawStrength = -0.8;
      reason += " -- OI actually falling (strong bearish divergence)";
    }
  } else if (priceNewLow && !oiFalling) {
    rawStrength = 0.5;
    reason = `Price making new lows but OI holding/rising (OI change: ${(((recentOIAvg / olderOIAvg) - 1) * 100).toFixed(1)}%)`;
    if (oiRising) {
      rawStrength = 0.8;
      reason += " -- OI rising (strong bullish divergence)";
    }
  }

  const strength = Math.round(rawStrength * 100) / 100;
  const confidence = clamp(Math.abs(rawStrength) * 0.9, 0, 0.9);
  const direction = directionFromStrength(strength);

  return { id, name, direction, strength, confidence: Math.round(confidence * 100) / 100, reason };
}

/**
 * S6 -- Retail Counter (Enhanced with FOMO Detection)
 * Detects FOMO crowding: OI rapid increase + extreme funding + retail vs top trader divergence
 * Counter-trades retail when they're extremely positioned
 */
async function s6RetailCounter(symbol: string): Promise<StrategyResult> {
  const id = "s6_retail_counter";
  const name = "Retail Counter";

  const [retailData, topData, oiData, fundingData] = await Promise.all([
    fetchRetailLSRatio(symbol, "5m", 30),
    fetchTopLSRatio(symbol, "5m", 30),
    fetchOIHistory(symbol, "5m", 48), // 4 hours
    fetchFundingRate(symbol, 1),
  ]);

  if (retailData.length === 0 || topData.length === 0) {
    return { id, name, direction: "neutral", strength: 0, confidence: 0, reason: "No retail/top trader data" };
  }

  const latestRetail = parseFloat(retailData[retailData.length - 1].longShortRatio);
  const latestTop = parseFloat(topData[topData.length - 1].longShortRatio);
  const divergence = Math.abs(latestRetail - latestTop);

  // Calculate OI change over 4 hours
  let oiChangePercent = 0;
  if (oiData.length >= 2) {
    const oldOI = parseFloat(oiData[0].sumOpenInterest);
    const newOI = parseFloat(oiData[oiData.length - 1].sumOpenInterest);
    oiChangePercent = ((newOI - oldOI) / oldOI) * 100;
  }

  // Get funding rate
  const funding = fundingData.length > 0 ? parseFloat(fundingData[0].fundingRate) : 0;

  // FOMO Score calculation
  let fomoScore = 0;
  if (oiChangePercent > 10) fomoScore += 0.3; // OI rapid increase
  if (Math.abs(funding) > 0.0005) fomoScore += 0.3; // Extreme funding
  if (divergence > 0.5) fomoScore += 0.4; // Retail vs top divergence

  let rawStrength = 0;
  let reason = "Retail ratio is balanced";

  // Enhanced counter-trade logic with FOMO detection
  if (fomoScore > 0.7) {
    // High FOMO detected - strong counter signal
    if (latestRetail > latestTop) {
      rawStrength = -clamp(fomoScore, 0, 1);
      reason = `FOMO detected (score ${fomoScore.toFixed(2)}): Retail too bullish (${latestRetail.toFixed(2)} vs top ${latestTop.toFixed(2)}) -> SHORT`;
    } else {
      rawStrength = clamp(fomoScore, 0, 1);
      reason = `FOMO detected (score ${fomoScore.toFixed(2)}): Retail too bearish (${latestRetail.toFixed(2)} vs top ${latestTop.toFixed(2)}) -> LONG`;
    }
  } else if (latestRetail > 2.5) {
    rawStrength = -clamp((latestRetail - 2.5) / 2, 0, 1);
    reason = `Retail ratio ${latestRetail.toFixed(3)} is extreme long -> counter-trade short`;
  } else if (latestRetail < 0.4) {
    rawStrength = clamp((0.4 - latestRetail) / 0.3, 0, 1);
    reason = `Retail ratio ${latestRetail.toFixed(3)} is extreme short -> counter-trade long`;
  }

  const strength = Math.round(rawStrength * 100) / 100;
  const confidence = clamp(Math.abs(rawStrength) * 0.8 + fomoScore * 0.2, 0, 1);
  const direction = directionFromStrength(strength);

  return { id, name, direction, strength, confidence: Math.round(confidence * 100) / 100, reason };
}

/**
 * S8 -- Smart Money Edge (SME)
 * Aggregate SME index from smart vs dumb whale PnL estimates.
 * Uses large trades from aggTrades to estimate.
 */
async function s8SmartMoneyEdge(symbol: string): Promise<StrategyResult> {
  const id = "s8_smart_money_edge";
  const name = "Smart Money Edge";

  const [trades, ticker] = await Promise.all([
    fetchAggTrades(symbol, 500),
    fetchTicker(symbol),
  ]);

  if (trades.length < 50) {
    return { id, name, direction: "neutral", strength: 0, confidence: 0, reason: "Insufficient trade data" };
  }

  const currentPrice = ticker.price; // TickerData always has a valid price

  let whaleBuyVolume = 0;
  let whaleSellVolume = 0;
  let retailBuyVolume = 0;
  let retailSellVolume = 0;

  for (const trade of trades) {
    const price = parseFloat(trade.p);
    const qty = parseFloat(trade.q);
    const value = price * qty;
    const isSell = trade.m; // if buyer is maker, the taker is selling

    if (value > 100_000) {
      if (isSell) {
        whaleSellVolume += value;
      } else {
        whaleBuyVolume += value;
      }
    } else {
      if (isSell) {
        retailSellVolume += value;
      } else {
        retailBuyVolume += value;
      }
    }
  }

  const totalWhale = whaleBuyVolume + whaleSellVolume;
  const totalRetail = retailBuyVolume + retailSellVolume;

  if (totalWhale === 0) {
    return { id, name, direction: "neutral", strength: 0, confidence: 0.1, reason: "No whale-size trades detected" };
  }

  const whaleBuyRatio = whaleBuyVolume / (totalWhale || 1);
  const retailBuyRatio = retailBuyVolume / (totalRetail || 1);

  const sme = whaleBuyRatio - retailBuyRatio;
  const rawStrength = clamp(sme / 0.2, -1, 1);
  const strength = Math.round(rawStrength * 100) / 100;

  const whaleProportion = totalWhale / (totalWhale + totalRetail);
  const confidence = clamp(Math.abs(rawStrength) * (0.5 + whaleProportion), 0, 1);

  const direction = directionFromStrength(strength);
  const reason = `SME index: ${sme.toFixed(3)} (whale buy ratio ${(whaleBuyRatio * 100).toFixed(1)}% vs retail ${(retailBuyRatio * 100).toFixed(1)}%) @ $${currentPrice.toFixed(0)}`;

  return { id, name, direction, strength, confidence: Math.round(confidence * 100) / 100, reason };
}

// ---------------------------------------------------------------------------
// Strategy weights for fusion
// ---------------------------------------------------------------------------

const STRATEGY_WEIGHTS: Record<string, number> = {
  s1_whale_tracking: 0.20,        // S1: Whale Tracking (20%)
  s2_capital_concentration: 0.15, // S2: Capital Concentration (15%)
  s3_funding_reversal: 0.12,      // S3: Funding Reversal (12%)
  s4_liquidity_grab: 0.10,        // S4: Liquidity Grab (10%)
  s5_oi_divergence: 0.08,         // S5: OI Divergence (8%)
  s6_retail_counter: 0.15,        // S6: Retail Counter (15%) - Enhanced with FOMO
  s7_stop_hunt: 0.10,             // S7: Stop Hunt (10%)
  s8_smart_money_edge: 0.10,      // S8: Smart Money Edge (10%)
};

const STRATEGY_DESCRIPTIONS: Record<string, string> = {
  s1_whale_tracking: "Track top trader positions vs retail",
  s2_capital_concentration: "Detect capital flow concentration via taker buy/sell",
  s3_funding_reversal: "Extreme funding rate reversal signal",
  s4_liquidity_grab: "Entry after liquidation cascade + stabilization",
  s5_oi_divergence: "Price vs open interest divergence detection",
  s6_retail_counter: "Counter-trade extreme retail/FOMO positioning",
  s7_stop_hunt: "Detect stop hunt wicks with volume spikes",
  s8_smart_money_edge: "SME index from whale vs retail flow",
};

const STRATEGY_ENABLED: Record<string, boolean> = {
  s1_whale_tracking: true,
  s2_capital_concentration: true,
  s3_funding_reversal: true,
  s4_liquidity_grab: true,
  s5_oi_divergence: true,
  s6_retail_counter: true,
  s7_stop_hunt: true,
  s8_smart_money_edge: true,
};

export function updateStrategyWeights(weights: Partial<Record<string, number>>): Record<string, number> {
  for (const [id, w] of Object.entries(weights)) {
    if (!(id in STRATEGY_WEIGHTS)) continue;
    if (typeof w !== "number" || Number.isNaN(w)) continue;
    STRATEGY_WEIGHTS[id] = clamp(w, 0, 1);
  }
  return { ...STRATEGY_WEIGHTS };
}

export function updateStrategyEnabled(enabledMap: Partial<Record<string, boolean>>): Record<string, boolean> {
  for (const [id, enabled] of Object.entries(enabledMap)) {
    if (!(id in STRATEGY_ENABLED)) continue;
    STRATEGY_ENABLED[id] = !!enabled;
  }
  return { ...STRATEGY_ENABLED };
}

// ---------------------------------------------------------------------------
// Signal history (in-memory ring buffer)
// ---------------------------------------------------------------------------

const HISTORY_MAX = 100;
const signalHistory: FusedSignal[] = [];

export function getSignalHistory(): FusedSignal[] {
  return [...signalHistory];
}

function pushSignalHistory(signal: FusedSignal): void {
  signalHistory.push(signal);
  if (signalHistory.length > HISTORY_MAX) {
    signalHistory.shift();
  }
}

// ---------------------------------------------------------------------------
// Data quality score
// ---------------------------------------------------------------------------

function computeDataQualityScore(strategies: StrategyResult[]): number {
  const dataAvailability = strategies.filter((s) => s.confidence > 0).length / strategies.length;

  const avgConfidence =
    strategies.reduce((a, s) => a + s.confidence, 0) / strategies.length;

  const nonNeutral = strategies.filter((s) => s.direction !== "neutral");
  let agreement = 0.5;
  if (nonNeutral.length >= 2) {
    const longCount = nonNeutral.filter((s) => s.direction === "long").length;
    const shortCount = nonNeutral.filter((s) => s.direction === "short").length;
    agreement = Math.max(longCount, shortCount) / nonNeutral.length;
  }

  const dqs = dataAvailability * 0.4 + avgConfidence * 0.3 + agreement * 0.3;
  return Math.round(clamp(dqs, 0, 1) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Main engine: compute all strategies and produce fused signal
// ---------------------------------------------------------------------------

export async function computeSignal(symbol: string = "BTC/USDT"): Promise<FusedSignal> {
  const allStrategies = await Promise.all([
    s1WhaleTracking(symbol),
    s2CapitalConcentration(symbol),
    s3FundingReversal(symbol),
    s4LiquidityGrab(symbol),
    s5OIDivergence(symbol),
    s6RetailCounter(symbol),
    s7StopHunt(symbol),
    s8SmartMoneyEdge(symbol),
  ]);

  const strategies = allStrategies.filter((s) => STRATEGY_ENABLED[s.id] !== false);

  if (strategies.length === 0) {
    return {
      symbol,
      direction: "neutral",
      strength: 0,
      confidence: 0,
      recommendedSize: 0,
      dataQualityScore: 0,
      strategies: [],
      timestamp: Date.now(),
    };
  }

  let weightedStrength = 0;
  let totalWeight = 0;
  let weightedConfidence = 0;

  for (const strategy of strategies) {
    const weight = STRATEGY_WEIGHTS[strategy.id] ?? 0.1;
    const effectiveWeight = weight * strategy.confidence;
    weightedStrength += strategy.strength * effectiveWeight;
    totalWeight += effectiveWeight;
    weightedConfidence += strategy.confidence * weight;
  }

  const fusedStrength = totalWeight > 0 ? weightedStrength / totalWeight : 0;
  const fusedConfidence = weightedConfidence;

  const strength = Math.round(clamp(fusedStrength, -1, 1) * 100) / 100;
  const confidence = Math.round(clamp(fusedConfidence, 0, 1) * 100) / 100;
  const direction = directionFromStrength(strength);

  const recommendedSize = Math.round(Math.abs(strength) * confidence * 5 * 100) / 100;

  const dataQualityScore = computeDataQualityScore(strategies);

  const signal: FusedSignal = {
    symbol,
    direction,
    strength,
    confidence,
    recommendedSize,
    dataQualityScore,
    strategies,
    timestamp: Date.now(),
  };

  pushSignalHistory(signal);

  return signal;
}

// ---------------------------------------------------------------------------
// Strategy configuration export
// ---------------------------------------------------------------------------

export interface StrategyConfig {
  id: string;
  name: string;
  description: string;
  weight: number;
  enabled: boolean;
}

export function getStrategyConfigs(): StrategyConfig[] {
  return Object.keys(STRATEGY_WEIGHTS).map((id) => ({
    id,
    name: id,
    description: STRATEGY_DESCRIPTIONS[id] || "",
    weight: STRATEGY_WEIGHTS[id],
    enabled: STRATEGY_ENABLED[id] !== false,
  }));
}

// Re-export utilities for use by other modules
export { toBinanceSymbol, binanceFetch, clamp, directionFromStrength };

// Re-export types
export type { RatioEntry, FundingEntry, OIHistEntry, TakerRatioEntry, AggTrade, TickerData };
