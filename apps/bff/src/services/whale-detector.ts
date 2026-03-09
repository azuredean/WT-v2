/**
 * Whale Detector
 *
 * Detects whale activity from real Binance aggregated trades data.
 * Classifies trades by size into participant types and calculates
 * the Smart Money Edge (SME) index.
 */

import {
  getAggTrades,
  getTicker,
  getTopLSRatio,
  getRetailLSRatio,
  type AggTrade,
} from "./data-provider.js";
import { clamp } from "./signal-engine.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParticipantType =
  | "smart_whale"
  | "dumb_whale"
  | "market_maker"
  | "large_trader"
  | "retail_herd"
  | "arbitrageur";

export interface WhaleActivity {
  id: string;
  exchange: string;
  symbol: string;
  participantType: ParticipantType;
  side: "buy" | "sell";
  /** USD value of the trade */
  size: number;
  price: number;
  timestamp: number;
}

export interface ParticipantProfile {
  type: ParticipantType;
  /** Estimated number of participants in this category */
  count: number;
  /** Estimated total PnL (USD) */
  totalPnl: number;
  /** Average leverage (estimated) */
  avgLeverage: number;
  /** Proportion of long positions (0-1) */
  longRatio: number;
}

export interface SMEResult {
  /** Smart Money Edge index (>1 = smart money winning) */
  sme: number;
  /** Total estimated smart whale PnL */
  smartPnl: number;
  /** Total estimated dumb whale PnL */
  dumbPnl: number;
  /** Total estimated retail PnL */
  retailPnl: number;
}

export interface WhaleDetectionResult {
  activities: WhaleActivity[];
  profiles: ParticipantProfile[];
  sme: SMEResult;
}

// ---------------------------------------------------------------------------
// Trade size thresholds (USD value)
// ---------------------------------------------------------------------------

const WHALE_THRESHOLD = 1_000_000;   // >$1M = whale
const LARGE_THRESHOLD = 500_000;     // >$500K = large trader
const MEDIUM_THRESHOLD = 100_000;    // >$100K = medium
const SMALL_THRESHOLD = 10_000;      // >$10K = small

// ---------------------------------------------------------------------------
// Enhanced participant classification with multi-dimensional features
// ---------------------------------------------------------------------------

interface ParticipantFeatures {
  avgPositionSize: number;
  winRate: number;
  avgHoldingTime: number;
  leverageAvg: number;
  counterTrendRatio: number;
  entryTimingScore: number;
  positionTurnover: number;
  bidAskSymmetry: number;
}

function classifyTrade(
  value: number,
  isBuyerMaker: boolean,
  priceVsAvg: number,
): ParticipantType {
  if (value >= WHALE_THRESHOLD) {
    // Market Maker detection: very large maker-side trades with high turnover
    if (isBuyerMaker && value > WHALE_THRESHOLD * 2) {
      return "market_maker";
    }
    
    // Smart Whale: counter-trend trading (buy low, sell high)
    // Buy below average or sell above average = smart behavior
    const isCounterTrend = 
      (!isBuyerMaker && priceVsAvg < -0.01) || // aggressive buy when price is low
      (isBuyerMaker && priceVsAvg > 0.01);     // aggressive sell when price is high
    
    if (isCounterTrend) {
      return "smart_whale";
    }
    
    // Dumb Whale: large size but trend-following (buy high, sell low)
    return "dumb_whale";
  }

  if (value >= LARGE_THRESHOLD) {
    return "large_trader";
  }

  // Arbitrageur: medium-sized trades with high frequency
  if (value >= MEDIUM_THRESHOLD) {
    return "arbitrageur";
  }

  return "retail_herd";
}

/**
 * Advanced participant classification based on multi-dimensional features
 * This is used when we have historical data for a participant
 */
function classifyParticipantAdvanced(features: ParticipantFeatures): ParticipantType {
  const { avgPositionSize, winRate, counterTrendRatio, positionTurnover, bidAskSymmetry, leverageAvg } = features;
  
  // Large capital participants (>$1M avg position)
  if (avgPositionSize > 1_000_000) {
    if (winRate > 0.55 && counterTrendRatio > 0.4) {
      return "smart_whale"; // High win rate + counter-trend = smart whale
    } else if (winRate < 0.45) {
      return "dumb_whale"; // Low win rate = dumb whale
    }
  }
  
  // Market Maker: high bid-ask symmetry + high turnover
  if (bidAskSymmetry > 0.8 && positionTurnover > 50) {
    return "market_maker";
  }
  
  // Retail: high leverage + small position size
  if (leverageAvg > 10 && avgPositionSize < 10_000) {
    return "retail_herd";
  }
  
  // Default to arbitrageur for others
  return "arbitrageur";
}

// ---------------------------------------------------------------------------
// Detect whale activities from recent aggregated trades
// ---------------------------------------------------------------------------

export async function detectWhaleActivity(
  symbol: string = "BTC/USDT",
): Promise<WhaleActivity[]> {
  const [trades, ticker] = await Promise.all([
    getAggTrades(symbol, 500),
    getTicker(symbol),
  ]);

  if (trades.length === 0) {
    return [];
  }

  const currentPrice = ticker.price;

  // Calculate average trade price as reference
  const avgPrice =
    trades.reduce((acc, t) => acc + parseFloat(t.p), 0) / trades.length;

  const activities: WhaleActivity[] = [];

  for (const trade of trades) {
    const price = parseFloat(trade.p);
    const qty = parseFloat(trade.q);
    const value = price * qty;

    // Only report trades above the small threshold
    if (value < SMALL_THRESHOLD) continue;

    const priceVsAvg = (price - avgPrice) / avgPrice;
    const participantType = classifyTrade(value, trade.m, priceVsAvg);

    // Filter to whale/large trades only for the activity feed
    if (value < LARGE_THRESHOLD && participantType !== "market_maker") continue;

    activities.push({
      id: trade.a.toString(),
      exchange: "binance",
      symbol,
      participantType,
      side: trade.m ? "sell" : "buy", // m=true means buyer is maker, so the aggressor is selling
      size: Math.round(value),
      price,
      timestamp: trade.T,
    });
  }

  // Sort by size descending
  activities.sort((a, b) => b.size - a.size);

  return activities;
}

// ---------------------------------------------------------------------------
// Build participant profiles from trade data
// ---------------------------------------------------------------------------

export async function getParticipantProfiles(
  symbol: string = "BTC/USDT",
): Promise<ParticipantProfile[]> {
  const [trades, ticker, topLS, retailLS] = await Promise.all([
    getAggTrades(symbol, 500),
    getTicker(symbol),
    getTopLSRatio(symbol, "5m", 1),
    getRetailLSRatio(symbol, "5m", 1),
  ]);

  if (trades.length === 0) {
    return getDefaultProfiles();
  }

  const currentPrice = ticker.price;
  const avgPrice = trades.reduce((acc, t) => acc + parseFloat(t.p), 0) / trades.length;

  // Get long/short ratios for profile construction
  const topLongRatio = topLS.length > 0 ? parseFloat(topLS[0].longAccount) : 0.5;
  const retailLongRatio = retailLS.length > 0 ? parseFloat(retailLS[0].longAccount) : 0.5;

  // Aggregate trade data by type
  const typeBuckets = new Map<ParticipantType, {
    count: number;
    buyVolume: number;
    sellVolume: number;
    totalValue: number;
  }>();

  const initBucket = () => ({ count: 0, buyVolume: 0, sellVolume: 0, totalValue: 0 });

  for (const trade of trades) {
    const price = parseFloat(trade.p);
    const qty = parseFloat(trade.q);
    const value = price * qty;
    const priceVsAvg = (price - avgPrice) / avgPrice;
    const pType = classifyTrade(value, trade.m, priceVsAvg);

    if (!typeBuckets.has(pType)) typeBuckets.set(pType, initBucket());
    const bucket = typeBuckets.get(pType)!;
    bucket.count++;
    bucket.totalValue += value;
    if (trade.m) {
      bucket.sellVolume += value;
    } else {
      bucket.buyVolume += value;
    }
  }

  // Build profiles
  const profiles: ParticipantProfile[] = [];

  const typeConfigs: Array<{
    type: ParticipantType;
    leverageEstimate: number;
    longRatioOverride?: number;
  }> = [
    { type: "smart_whale", leverageEstimate: 3.0, longRatioOverride: topLongRatio },
    { type: "dumb_whale", leverageEstimate: 8.0 },
    { type: "market_maker", leverageEstimate: 1.0 },
    { type: "large_trader", leverageEstimate: 5.0 },
    { type: "retail_herd", leverageEstimate: 15.0, longRatioOverride: retailLongRatio },
    { type: "arbitrageur", leverageEstimate: 2.0 },
  ];

  for (const config of typeConfigs) {
    const bucket = typeBuckets.get(config.type) ?? initBucket();
    const total = bucket.buyVolume + bucket.sellVolume;
    const longRatio = config.longRatioOverride ??
      (total > 0 ? bucket.buyVolume / total : 0.5);

    // Estimate PnL: smart traders buy low, sell high (positive PnL);
    // dumb traders do the opposite; retail is generally negative
    let pnlMultiplier = 0;
    switch (config.type) {
      case "smart_whale": pnlMultiplier = 0.05; break;   // ~5% profit on volume
      case "dumb_whale": pnlMultiplier = -0.03; break;   // ~3% loss
      case "market_maker": pnlMultiplier = 0.005; break;  // thin margins
      case "large_trader": pnlMultiplier = 0.01; break;
      case "retail_herd": pnlMultiplier = -0.02; break;   // ~2% loss
      case "arbitrageur": pnlMultiplier = 0.002; break;
    }

    // Scale count estimate: whales are few, retail is many
    let countEstimate = bucket.count;
    if (config.type === "retail_herd") {
      // Retail trades are many small ones; scale up the count estimate
      countEstimate = Math.max(bucket.count * 100, 10000);
    } else if (config.type === "smart_whale" || config.type === "dumb_whale") {
      countEstimate = Math.max(bucket.count, 10);
    } else if (config.type === "market_maker") {
      countEstimate = Math.max(bucket.count, 5);
    }

    profiles.push({
      type: config.type,
      count: countEstimate,
      totalPnl: Math.round(bucket.totalValue * pnlMultiplier),
      avgLeverage: config.leverageEstimate,
      longRatio: Math.round(longRatio * 100) / 100,
    });
  }

  return profiles;
}

function getDefaultProfiles(): ParticipantProfile[] {
  return [
    { type: "smart_whale", count: 0, totalPnl: 0, avgLeverage: 3.0, longRatio: 0.5 },
    { type: "dumb_whale", count: 0, totalPnl: 0, avgLeverage: 8.0, longRatio: 0.5 },
    { type: "market_maker", count: 0, totalPnl: 0, avgLeverage: 1.0, longRatio: 0.5 },
    { type: "large_trader", count: 0, totalPnl: 0, avgLeverage: 5.0, longRatio: 0.5 },
    { type: "retail_herd", count: 0, totalPnl: 0, avgLeverage: 15.0, longRatio: 0.5 },
    { type: "arbitrageur", count: 0, totalPnl: 0, avgLeverage: 2.0, longRatio: 0.5 },
  ];
}

// ---------------------------------------------------------------------------
// Smart Money Edge (SME) calculation
// ---------------------------------------------------------------------------

export async function calculateSME(
  symbol: string = "BTC/USDT",
): Promise<SMEResult> {
  const [trades, ticker] = await Promise.all([
    getAggTrades(symbol, 500),
    getTicker(symbol),
  ]);

  if (trades.length === 0) {
    return { sme: 1.0, smartPnl: 0, dumbPnl: 0, retailPnl: 0 };
  }

  const avgPrice = trades.reduce((acc, t) => acc + parseFloat(t.p), 0) / trades.length;
  const currentPrice = ticker.price;

  let smartBuyValue = 0;
  let smartSellValue = 0;
  let dumbBuyValue = 0;
  let dumbSellValue = 0;
  let retailBuyValue = 0;
  let retailSellValue = 0;

  for (const trade of trades) {
    const price = parseFloat(trade.p);
    const qty = parseFloat(trade.q);
    const value = price * qty;
    const priceVsAvg = (price - avgPrice) / avgPrice;
    const pType = classifyTrade(value, trade.m, priceVsAvg);
    const isSell = trade.m;

    switch (pType) {
      case "smart_whale":
      case "market_maker":
        if (isSell) smartSellValue += value; else smartBuyValue += value;
        break;
      case "dumb_whale":
      case "large_trader":
        if (isSell) dumbSellValue += value; else dumbBuyValue += value;
        break;
      default:
        if (isSell) retailSellValue += value; else retailBuyValue += value;
    }
  }

  // Estimate PnL based on position direction relative to price movement
  const priceChange = (currentPrice - avgPrice) / avgPrice;

  // If net buyer (buy > sell) and price went up -> profit
  // PnL estimate = net position * price change
  const smartNetBuy = smartBuyValue - smartSellValue;
  const dumbNetBuy = dumbBuyValue - dumbSellValue;
  const retailNetBuy = retailBuyValue - retailSellValue;

  const smartPnl = Math.round(smartNetBuy * priceChange);
  const dumbPnl = Math.round(dumbNetBuy * priceChange);
  const retailPnl = Math.round(retailNetBuy * priceChange);

  // SME = |smart PnL| / |dumb PnL| (>1 means smart money is winning)
  const absSmart = Math.abs(smartPnl) || 1;
  const absDumb = Math.abs(dumbPnl) || 1;

  // Adjust: if smart money is profitable and dumb money is losing, SME > 1
  let sme: number;
  if (smartPnl >= 0 && dumbPnl <= 0) {
    sme = 1 + absSmart / (absSmart + absDumb);
  } else if (smartPnl <= 0 && dumbPnl >= 0) {
    sme = absDumb / (absSmart + absDumb);
  } else {
    sme = 1 + (smartPnl - dumbPnl) / (absSmart + absDumb);
  }

  return {
    sme: Math.round(clamp(sme, 0, 3) * 100) / 100,
    smartPnl,
    dumbPnl,
    retailPnl,
  };
}

// ---------------------------------------------------------------------------
// Full detection pipeline
// ---------------------------------------------------------------------------

export async function detectWhales(
  symbol: string = "BTC/USDT",
): Promise<WhaleDetectionResult> {
  const [activities, profiles, sme] = await Promise.all([
    detectWhaleActivity(symbol),
    getParticipantProfiles(symbol),
    calculateSME(symbol),
  ]);

  return { activities, profiles, sme };
}
