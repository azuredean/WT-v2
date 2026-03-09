/**
 * Advanced Trading Strategies (S6, S7, S8)
 * 
 * S6: Retail Counter Signal (FOMO Crowding Detection)
 * S7: Stop Hunt Reversal Detection
 * S8: Smart Money Edge (SME) Index
 * 
 * Plus: Liquidation Fuel Analysis, Liquidity Vacuum Detection, OI Divergence, etc.
 */

import {
  getCandles,
  getOIHistory,
  getFundingRate,
  getTopLSRatio,
  getRetailLSRatio,
  getTakerRatio,
  getAggTrades,
  getTicker,
  type Kline,
} from "./data-provider.js";
import { calculateSME } from "./whale-detector.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FOMOSignal {
  signal: "LONG" | "SHORT" | "NEUTRAL";
  score: number; // 0-1
  oiChange: number;
  fundingRate: number;
  lsRatioDivergence: number;
  confidence: number;
}

export interface StopHuntSignal {
  detected: boolean;
  direction: "BULLISH" | "BEARISH" | null;
  price: number;
  wickRatio: number;
  volumeSpike: number;
  confidence: number;
}

export interface LiquidationCluster {
  price: number;
  volume: number; // USD
  side: "LONG" | "SHORT";
  count: number;
}

export interface LiquidationAnalysis {
  cascadeDetected: boolean;
  clusters: LiquidationCluster[];
  totalLongLiq: number;
  totalShortLiq: number;
  liqRatio: number; // long / short
  signal: "LONG" | "SHORT" | "NEUTRAL";
}

export interface LiquidityVacuumSignal {
  detected: boolean;
  depthDrop: number; // percentage
  spreadExpansion: number; // multiplier
  severity: "LOW" | "MEDIUM" | "HIGH";
}

export interface OIDivergenceSignal {
  scenario: 
    | "HEALTHY_UPTREND"
    | "LONG_CROWDING"
    | "SHORT_SQUEEZE"
    | "HEALTHY_DOWNTREND"
    | "PANIC_LIQUIDATION"
    | "ACCUMULATION";
  signal: "LONG" | "SHORT" | "NEUTRAL" | "REDUCE";
  confidence: number;
  priceChange: number;
  oiChange: number;
  fundingRate: number;
}

export interface WyckoffPhase {
  phase: "ACCUMULATION" | "MARKUP" | "DISTRIBUTION" | "MARKDOWN" | "UNKNOWN";
  signal: "LONG" | "SHORT" | "NEUTRAL";
  confidence: number;
  priceVolatility: number;
  volumeTrend: string;
  whaleActivity: string;
}

export interface MarketMicrostructure {
  cvdDivergence: boolean;
  orderbookAsymmetry: number; // -1 to 1 (negative = sell pressure)
  largeTradeDirection: "BUY" | "SELL" | "NEUTRAL";
  largeTradeCount: number;
  signal: "LONG" | "SHORT" | "NEUTRAL";
}

// ---------------------------------------------------------------------------
// S6: Retail Counter Signal (FOMO Crowding Detection)
// ---------------------------------------------------------------------------

export async function detectFOMOCrowding(
  symbol: string = "BTC/USDT",
): Promise<FOMOSignal> {
  const [oiData, fundingData, topLS, retailLS] = await Promise.all([
    getOIHistory(symbol, "5m", 48), // 4 hours of data
    getFundingRate(symbol),
    getTopLSRatio(symbol, "5m", 1),
    getRetailLSRatio(symbol, "5m", 1),
  ]);

  if (oiData.length < 2) {
    return {
      signal: "NEUTRAL",
      score: 0,
      oiChange: 0,
      fundingRate: 0,
      lsRatioDivergence: 0,
      confidence: 0,
    };
  }

  // Calculate OI change over 4 hours
  const latestOI = parseFloat(oiData[oiData.length - 1].sumOpenInterest);
  const oldestOI = parseFloat(oiData[0].sumOpenInterest);
  const oiChangePercent = ((latestOI - oldestOI) / oldestOI) * 100;

  // Get funding rate
  const funding = parseFloat(fundingData.lastFundingRate);

  // Get long/short ratios
  const topLongRatio = topLS.length > 0 ? parseFloat(topLS[0].longAccount) : 0.5;
  const retailLongRatio = retailLS.length > 0 ? parseFloat(retailLS[0].longAccount) : 0.5;
  const divergence = Math.abs(topLongRatio - retailLongRatio);

  // FOMO Score calculation
  let fomoScore = 0;

  // 1. OI rapid increase (>10% in 4h)
  if (oiChangePercent > 10) {
    fomoScore += 0.3;
  }

  // 2. Extreme funding rate (>0.05% or <-0.05%)
  if (Math.abs(funding) > 0.0005) {
    fomoScore += 0.3;
  }

  // 3. Retail vs Top Trader divergence (>0.5)
  if (divergence > 0.5) {
    fomoScore += 0.4;
  }

  // Determine signal direction
  let signal: "LONG" | "SHORT" | "NEUTRAL" = "NEUTRAL";
  
  if (fomoScore > 0.7) {
    // High FOMO detected - counter-trade retail
    if (retailLongRatio > topLongRatio) {
      signal = "SHORT"; // Retail is too bullish, go short
    } else {
      signal = "LONG"; // Retail is too bearish, go long
    }
  }

  return {
    signal,
    score: Math.min(fomoScore, 1.0),
    oiChange: oiChangePercent,
    fundingRate: funding,
    lsRatioDivergence: divergence,
    confidence: fomoScore > 0.7 ? 0.8 : 0.5,
  };
}

// ---------------------------------------------------------------------------
// S7: Stop Hunt Reversal Detection
// ---------------------------------------------------------------------------

export async function detectStopHunt(
  symbol: string = "BTC/USDT",
): Promise<StopHuntSignal> {
  const candles = await getCandles(symbol, "5m", 20);

  if (candles.length < 3) {
    return {
      detected: false,
      direction: null,
      price: 0,
      wickRatio: 0,
      volumeSpike: 0,
      confidence: 0,
    };
  }

  // Calculate average volume
  const avgVolume = candles.reduce((sum, c) => sum + parseFloat(c.volume), 0) / candles.length;

  // Check last 3 candles for stop hunt pattern
  for (let i = candles.length - 3; i < candles.length - 1; i++) {
    const candle = candles[i];
    const nextCandle = candles[i + 1];

    const open = parseFloat(candle.open);
    const high = parseFloat(candle.high);
    const low = parseFloat(candle.low);
    const close = parseFloat(candle.close);
    const volume = parseFloat(candle.volume);

    const nextClose = parseFloat(nextCandle.close);

    const totalRange = high - low;
    if (totalRange === 0) continue;

    // Bullish stop hunt: long lower wick, then recovery
    const lowerWick = Math.min(open, close) - low;
    const lowerWickRatio = lowerWick / totalRange;

    // Bearish stop hunt: long upper wick, then drop
    const upperWick = high - Math.max(open, close);
    const upperWickRatio = upperWick / totalRange;

    const volumeSpike = volume / avgVolume;

    // Bullish stop hunt detection
    if (
      lowerWickRatio > 0.6 &&
      volumeSpike > 2.0 &&
      nextClose > open
    ) {
      return {
        detected: true,
        direction: "BULLISH",
        price: low,
        wickRatio: lowerWickRatio,
        volumeSpike,
        confidence: Math.min(lowerWickRatio * volumeSpike / 3, 1.0),
      };
    }

    // Bearish stop hunt detection
    if (
      upperWickRatio > 0.6 &&
      volumeSpike > 2.0 &&
      nextClose < open
    ) {
      return {
        detected: true,
        direction: "BEARISH",
        price: high,
        wickRatio: upperWickRatio,
        volumeSpike,
        confidence: Math.min(upperWickRatio * volumeSpike / 3, 1.0),
      };
    }
  }

  return {
    detected: false,
    direction: null,
    price: 0,
    wickRatio: 0,
    volumeSpike: 0,
    confidence: 0,
  };
}

// ---------------------------------------------------------------------------
// Liquidation Fuel Analysis
// ---------------------------------------------------------------------------

export async function analyzeLiquidationFuel(
  symbol: string = "BTC/USDT",
): Promise<LiquidationAnalysis> {
  // Note: Real liquidation data requires CoinGlass API or exchange-specific endpoints
  // For now, we estimate based on OI changes and funding rate extremes
  
  const [oiData, fundingData, candles] = await Promise.all([
    getOIHistory(symbol, "5m", 12), // 1 hour
    getFundingRate(symbol),
    getCandles(symbol, "5m", 12),
  ]);

  if (oiData.length < 2 || candles.length < 2) {
    return {
      cascadeDetected: false,
      clusters: [],
      totalLongLiq: 0,
      totalShortLiq: 0,
      liqRatio: 1.0,
      signal: "NEUTRAL",
    };
  }

  // Detect OI drops (proxy for liquidations)
  const clusters: LiquidationCluster[] = [];
  let totalLongLiq = 0;
  let totalShortLiq = 0;

  for (let i = 1; i < oiData.length; i++) {
    const prevOI = parseFloat(oiData[i - 1].sumOpenInterest);
    const currOI = parseFloat(oiData[i].sumOpenInterest);
    const oiDrop = prevOI - currOI;

    if (oiDrop > prevOI * 0.02) { // >2% drop = liquidation event
      const candle = candles[i];
      const price = parseFloat(candle.close);
      const volume = oiDrop * price; // Estimate USD volume

      // Determine side based on price movement
      const priceChange = parseFloat(candle.close) - parseFloat(candle.open);
      const side = priceChange < 0 ? "LONG" : "SHORT";

      clusters.push({
        price,
        volume,
        side,
        count: 1,
      });

      if (side === "LONG") {
        totalLongLiq += volume;
      } else {
        totalShortLiq += volume;
      }
    }
  }

  const cascadeDetected = clusters.length >= 3; // 3+ liquidation events in 1 hour
  const liqRatio = totalShortLiq > 0 ? totalLongLiq / totalShortLiq : 1.0;

  // Signal: after cascade, price stabilization = entry opportunity
  let signal: "LONG" | "SHORT" | "NEUTRAL" = "NEUTRAL";
  if (cascadeDetected) {
    if (totalLongLiq > totalShortLiq * 2) {
      signal = "LONG"; // Longs liquidated, smart money buying
    } else if (totalShortLiq > totalLongLiq * 2) {
      signal = "SHORT"; // Shorts liquidated, smart money selling
    }
  }

  return {
    cascadeDetected,
    clusters,
    totalLongLiq,
    totalShortLiq,
    liqRatio,
    signal,
  };
}

// ---------------------------------------------------------------------------
// Liquidity Vacuum Detection
// ---------------------------------------------------------------------------

export async function detectLiquidityVacuum(
  symbol: string = "BTC/USDT",
): Promise<LiquidityVacuumSignal> {
  // Note: Real orderbook depth requires WebSocket or REST orderbook endpoint
  // This is a placeholder implementation
  
  const ticker = await getTicker(symbol);
  
  // Estimate spread from ticker (real implementation would use orderbook)
  const price = ticker.price;
  const estimatedSpread = price * 0.0001; // 0.01% as baseline
  
  // Placeholder: detect based on volume drops
  const candles = await getCandles(symbol, "1m", 60);
  if (candles.length < 2) {
    return {
      detected: false,
      depthDrop: 0,
      spreadExpansion: 1.0,
      severity: "LOW",
    };
  }

  const avgVolume = candles.reduce((sum, c) => sum + parseFloat(c.volume), 0) / candles.length;
  const recentVolume = parseFloat(candles[candles.length - 1].volume);
  const volumeDrop = (avgVolume - recentVolume) / avgVolume;

  const detected = volumeDrop > 0.5; // 50% volume drop
  const severity = volumeDrop > 0.7 ? "HIGH" : volumeDrop > 0.5 ? "MEDIUM" : "LOW";

  return {
    detected,
    depthDrop: volumeDrop * 100,
    spreadExpansion: 1.0 + volumeDrop * 2, // Estimate
    severity,
  };
}

// ---------------------------------------------------------------------------
// OI vs Price Divergence Detection
// ---------------------------------------------------------------------------

export async function detectOIDivergence(
  symbol: string = "BTC/USDT",
): Promise<OIDivergenceSignal> {
  const [oiData, candles, fundingData] = await Promise.all([
    getOIHistory(symbol, "15m", 96), // 24 hours
    getCandles(symbol, "15m", 96),
    getFundingRate(symbol),
  ]);

  if (oiData.length < 2 || candles.length < 2) {
    return {
      scenario: "HEALTHY_UPTREND",
      signal: "NEUTRAL",
      confidence: 0,
      priceChange: 0,
      oiChange: 0,
      fundingRate: 0,
    };
  }

  // Calculate 24h changes
  const oldPrice = parseFloat(candles[0].close);
  const newPrice = parseFloat(candles[candles.length - 1].close);
  const priceChange = ((newPrice - oldPrice) / oldPrice) * 100;

  const oldOI = parseFloat(oiData[0].sumOpenInterest);
  const newOI = parseFloat(oiData[oiData.length - 1].sumOpenInterest);
  const oiChange = ((newOI - oldOI) / oldOI) * 100;

  const funding = parseFloat(fundingData.lastFundingRate);

  // Scenario classification
  let scenario: OIDivergenceSignal["scenario"] = "HEALTHY_UPTREND";
  let signal: "LONG" | "SHORT" | "NEUTRAL" | "REDUCE" = "NEUTRAL";
  let confidence = 0.5;

  if (priceChange > 5 && oiChange > 5 && funding > 0 && funding < 0.001) {
    scenario = "HEALTHY_UPTREND";
    signal = "LONG";
    confidence = 0.7;
  } else if (priceChange > 5 && oiChange > 15 && funding > 0.001) {
    scenario = "LONG_CROWDING";
    signal = "REDUCE";
    confidence = 0.8;
  } else if (priceChange > 5 && oiChange < -5) {
    scenario = "SHORT_SQUEEZE";
    signal = "NEUTRAL";
    confidence = 0.6;
  } else if (priceChange < -5 && oiChange > 5 && funding < 0 && funding > -0.001) {
    scenario = "HEALTHY_DOWNTREND";
    signal = "SHORT";
    confidence = 0.7;
  } else if (priceChange < -5 && oiChange < -10) {
    scenario = "PANIC_LIQUIDATION";
    signal = "LONG"; // Reversal opportunity
    confidence = 0.8;
  } else if (Math.abs(priceChange) < 3 && oiChange > 5 && Math.abs(funding) < 0.0003) {
    scenario = "ACCUMULATION";
    signal = "LONG";
    confidence = 0.75;
  }

  return {
    scenario,
    signal,
    confidence,
    priceChange,
    oiChange,
    fundingRate: funding,
  };
}

// ---------------------------------------------------------------------------
// Wyckoff Accumulation/Distribution Detection
// ---------------------------------------------------------------------------

export async function detectWyckoffPhase(
  symbol: string = "BTC/USDT",
): Promise<WyckoffPhase> {
  const candles = await getCandles(symbol, "1h", 168); // 7 days

  if (candles.length < 50) {
    return {
      phase: "UNKNOWN",
      signal: "NEUTRAL",
      confidence: 0,
      priceVolatility: 0,
      volumeTrend: "unknown",
      whaleActivity: "unknown",
    };
  }

  // Calculate price volatility (standard deviation of returns)
  const prices = candles.map(c => parseFloat(c.close));
  const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * 100;

  // Calculate volume trend
  const volumes = candles.map(c => parseFloat(c.volume));
  const recentVolume = volumes.slice(-24).reduce((sum, v) => sum + v, 0) / 24;
  const oldVolume = volumes.slice(0, 24).reduce((sum, v) => sum + v, 0) / 24;
  const volumeTrend = recentVolume > oldVolume * 1.2 ? "increasing" : 
                      recentVolume < oldVolume * 0.8 ? "decreasing" : "stable";

  // Price trend
  const recentPrice = prices[prices.length - 1];
  const oldPrice = prices[0];
  const priceChange = ((recentPrice - oldPrice) / oldPrice) * 100;

  // Determine Wyckoff phase
  let phase: WyckoffPhase["phase"] = "UNKNOWN";
  let signal: "LONG" | "SHORT" | "NEUTRAL" = "NEUTRAL";
  let confidence = 0.5;

  if (volatility < 2 && volumeTrend === "decreasing" && Math.abs(priceChange) < 5) {
    phase = "ACCUMULATION";
    signal = "LONG";
    confidence = 0.7;
  } else if (priceChange > 10 && volumeTrend === "increasing") {
    phase = "MARKUP";
    signal = "LONG";
    confidence = 0.8;
  } else if (volatility < 2 && volumeTrend === "decreasing" && priceChange > 15) {
    phase = "DISTRIBUTION";
    signal = "SHORT";
    confidence = 0.7;
  } else if (priceChange < -10 && volumeTrend === "increasing") {
    phase = "MARKDOWN";
    signal = "SHORT";
    confidence = 0.8;
  }

  return {
    phase,
    signal,
    confidence,
    priceVolatility: volatility,
    volumeTrend,
    whaleActivity: "estimated", // Would need whale-detector integration
  };
}

// ---------------------------------------------------------------------------
// Market Microstructure Signals
// ---------------------------------------------------------------------------

export async function analyzeMarketMicrostructure(
  symbol: string = "BTC/USDT",
): Promise<MarketMicrostructure> {
  const [trades, takerRatio] = await Promise.all([
    getAggTrades(symbol, 200),
    getTakerRatio(symbol, "5m", 12), // 1 hour
  ]);

  if (trades.length === 0) {
    return {
      cvdDivergence: false,
      orderbookAsymmetry: 0,
      largeTradeDirection: "NEUTRAL",
      largeTradeCount: 0,
      signal: "NEUTRAL",
    };
  }

  // Calculate CVD (Cumulative Volume Delta)
  let cvd = 0;
  for (const trade of trades) {
    const volume = parseFloat(trade.q) * parseFloat(trade.p);
    cvd += trade.m ? -volume : volume; // m=true means sell
  }

  // Detect large trades (>$100K)
  const largeTrades = trades.filter(t => {
    const value = parseFloat(t.q) * parseFloat(t.p);
    return value > 100_000;
  });

  const largeBuys = largeTrades.filter(t => !t.m).length;
  const largeSells = largeTrades.filter(t => t.m).length;
  const largeTradeDirection = largeBuys > largeSells ? "BUY" : 
                              largeSells > largeBuys ? "SELL" : "NEUTRAL";

  // Orderbook asymmetry from taker ratio
  const avgTakerRatio = takerRatio.length > 0
    ? takerRatio.reduce((sum, r) => sum + parseFloat(r.buySellRatio), 0) / takerRatio.length
    : 1.0;
  const orderbookAsymmetry = (avgTakerRatio - 1.0) / 2; // Normalize to -1 to 1

  // CVD divergence: CVD positive but price falling (or vice versa)
  const priceChange = parseFloat(trades[trades.length - 1].p) - parseFloat(trades[0].p);
  const cvdDivergence = (cvd > 0 && priceChange < 0) || (cvd < 0 && priceChange > 0);

  // Signal
  let signal: "LONG" | "SHORT" | "NEUTRAL" = "NEUTRAL";
  if (cvd > 0 && largeTradeDirection === "BUY") {
    signal = "LONG";
  } else if (cvd < 0 && largeTradeDirection === "SELL") {
    signal = "SHORT";
  }

  return {
    cvdDivergence,
    orderbookAsymmetry,
    largeTradeDirection,
    largeTradeCount: largeTrades.length,
    signal,
  };
}
