import {
  getCandles,
  getOIHistory,
  getFundingRate,
  getTopLSRatio,
  getRetailLSRatio,
  getTakerRatio,
  getAggTrades,
} from "./data-provider.js";

export interface FOMOSignal {
  signal: "LONG" | "SHORT" | "NEUTRAL";
  score: number;
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
  volume: number;
  side: "LONG" | "SHORT";
  count: number;
}

export interface LiquidationAnalysis {
  cascadeDetected: boolean;
  clusters: LiquidationCluster[];
  totalLongLiq: number;
  totalShortLiq: number;
  liqRatio: number;
  signal: "LONG" | "SHORT" | "NEUTRAL";
}

export interface LiquidityVacuumSignal {
  detected: boolean;
  depthDrop: number;
  spreadExpansion: number;
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
  orderbookAsymmetry: number;
  largeTradeDirection: "BUY" | "SELL" | "NEUTRAL";
  largeTradeCount: number;
  signal: "LONG" | "SHORT" | "NEUTRAL";
}

export async function detectFOMOCrowding(symbol = "BTC/USDT"): Promise<FOMOSignal> {
  const [oiData, fundingData, topLS, retailLS] = await Promise.all([
    getOIHistory(symbol, "5m", 48),
    getFundingRate(symbol, 1),
    getTopLSRatio(symbol, "5m", 1),
    getRetailLSRatio(symbol, "5m", 1),
  ]);

  if (oiData.length < 2) {
    return { signal: "NEUTRAL", score: 0, oiChange: 0, fundingRate: 0, lsRatioDivergence: 0, confidence: 0 };
  }

  const latestOI = parseFloat(oiData[oiData.length - 1].sumOpenInterest);
  const oldestOI = parseFloat(oiData[0].sumOpenInterest);
  const oiChange = oldestOI > 0 ? ((latestOI - oldestOI) / oldestOI) * 100 : 0;
  const fundingRate = fundingData.length > 0 ? parseFloat(fundingData[0].fundingRate) : 0;
  const topRatio = topLS.length > 0 ? parseFloat(topLS[0].longShortRatio) : 1;
  const retailRatio = retailLS.length > 0 ? parseFloat(retailLS[0].longShortRatio) : 1;
  const divergence = Math.abs(retailRatio - topRatio);

  let score = 0;
  if (oiChange > 10) score += 0.3;
  if (Math.abs(fundingRate) > 0.0005) score += 0.3;
  if (divergence > 0.5) score += 0.4;

  let signal: FOMOSignal["signal"] = "NEUTRAL";
  if (score > 0.7) signal = retailRatio > topRatio ? "SHORT" : "LONG";

  return {
    signal,
    score: Math.min(score, 1),
    oiChange,
    fundingRate,
    lsRatioDivergence: divergence,
    confidence: score > 0.7 ? 0.8 : 0.5,
  };
}

export async function detectStopHunt(symbol = "BTC/USDT"): Promise<StopHuntSignal> {
  const { candles } = await getCandles(symbol, "5m", 20);
  if (candles.length < 3) {
    return { detected: false, direction: null, price: 0, wickRatio: 0, volumeSpike: 0, confidence: 0 };
  }

  const avgVolume = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
  for (let i = candles.length - 3; i < candles.length - 1; i++) {
    const c = candles[i];
    const next = candles[i + 1];
    const range = c.high - c.low;
    if (range <= 0) continue;
    const lowerWickRatio = (Math.min(c.open, c.close) - c.low) / range;
    const upperWickRatio = (c.high - Math.max(c.open, c.close)) / range;
    const volumeSpike = avgVolume > 0 ? c.volume / avgVolume : 0;

    if (lowerWickRatio > 0.6 && volumeSpike > 2 && next.close > c.open) {
      return { detected: true, direction: "BULLISH", price: c.low, wickRatio: lowerWickRatio, volumeSpike, confidence: Math.min(1, lowerWickRatio * volumeSpike / 3) };
    }
    if (upperWickRatio > 0.6 && volumeSpike > 2 && next.close < c.open) {
      return { detected: true, direction: "BEARISH", price: c.high, wickRatio: upperWickRatio, volumeSpike, confidence: Math.min(1, upperWickRatio * volumeSpike / 3) };
    }
  }

  return { detected: false, direction: null, price: 0, wickRatio: 0, volumeSpike: 0, confidence: 0 };
}

export async function analyzeLiquidationFuel(symbol = "BTC/USDT"): Promise<LiquidationAnalysis> {
  const [oiData, { candles }] = await Promise.all([getOIHistory(symbol, "5m", 12), getCandles(symbol, "5m", 12)]);
  if (oiData.length < 2 || candles.length < 2) {
    return { cascadeDetected: false, clusters: [], totalLongLiq: 0, totalShortLiq: 0, liqRatio: 1, signal: "NEUTRAL" };
  }

  const clusters: LiquidationCluster[] = [];
  let totalLongLiq = 0;
  let totalShortLiq = 0;

  for (let i = 1; i < oiData.length && i < candles.length; i++) {
    const prevOI = parseFloat(oiData[i - 1].sumOpenInterest);
    const currOI = parseFloat(oiData[i].sumOpenInterest);
    if (prevOI <= 0) continue;
    const drop = prevOI - currOI;
    if (drop <= prevOI * 0.02) continue;

    const candle = candles[i];
    const estVol = drop * candle.close;
    const side: LiquidationCluster["side"] = candle.close < candle.open ? "LONG" : "SHORT";
    clusters.push({ price: candle.close, volume: estVol, side, count: 1 });
    if (side === "LONG") totalLongLiq += estVol;
    else totalShortLiq += estVol;
  }

  const cascadeDetected = clusters.length >= 3;
  const liqRatio = totalShortLiq > 0 ? totalLongLiq / totalShortLiq : 1;
  let signal: LiquidationAnalysis["signal"] = "NEUTRAL";
  if (cascadeDetected) {
    if (totalLongLiq > totalShortLiq * 2) signal = "LONG";
    else if (totalShortLiq > totalLongLiq * 2) signal = "SHORT";
  }

  return { cascadeDetected, clusters, totalLongLiq, totalShortLiq, liqRatio, signal };
}

export async function detectLiquidityVacuum(symbol = "BTC/USDT"): Promise<LiquidityVacuumSignal> {
  const { candles } = await getCandles(symbol, "1m", 60);
  if (candles.length < 2) return { detected: false, depthDrop: 0, spreadExpansion: 1, severity: "LOW" };

  const avgVolume = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
  const recentVolume = candles[candles.length - 1].volume;
  const drop = avgVolume > 0 ? (avgVolume - recentVolume) / avgVolume : 0;
  return {
    detected: drop > 0.5,
    depthDrop: drop * 100,
    spreadExpansion: 1 + drop * 2,
    severity: drop > 0.7 ? "HIGH" : drop > 0.5 ? "MEDIUM" : "LOW",
  };
}

export async function detectOIDivergence(symbol = "BTC/USDT"): Promise<OIDivergenceSignal> {
  const [oiData, { candles }, fundingData] = await Promise.all([
    getOIHistory(symbol, "15m", 96),
    getCandles(symbol, "15m", 96),
    getFundingRate(symbol, 1),
  ]);

  if (oiData.length < 2 || candles.length < 2) {
    return { scenario: "HEALTHY_UPTREND", signal: "NEUTRAL", confidence: 0, priceChange: 0, oiChange: 0, fundingRate: 0 };
  }

  const oldPrice = candles[0].close;
  const newPrice = candles[candles.length - 1].close;
  const priceChange = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;
  const oldOI = parseFloat(oiData[0].sumOpenInterest);
  const newOI = parseFloat(oiData[oiData.length - 1].sumOpenInterest);
  const oiChange = oldOI > 0 ? ((newOI - oldOI) / oldOI) * 100 : 0;
  const fundingRate = fundingData.length > 0 ? parseFloat(fundingData[0].fundingRate) : 0;

  let scenario: OIDivergenceSignal["scenario"] = "HEALTHY_UPTREND";
  let signal: OIDivergenceSignal["signal"] = "NEUTRAL";
  let confidence = 0.5;

  if (priceChange > 5 && oiChange > 5 && fundingRate > 0 && fundingRate < 0.001) {
    scenario = "HEALTHY_UPTREND"; signal = "LONG"; confidence = 0.7;
  } else if (priceChange > 5 && oiChange > 15 && fundingRate > 0.001) {
    scenario = "LONG_CROWDING"; signal = "REDUCE"; confidence = 0.8;
  } else if (priceChange > 5 && oiChange < -5) {
    scenario = "SHORT_SQUEEZE"; signal = "NEUTRAL"; confidence = 0.6;
  } else if (priceChange < -5 && oiChange > 5 && fundingRate < 0 && fundingRate > -0.001) {
    scenario = "HEALTHY_DOWNTREND"; signal = "SHORT"; confidence = 0.7;
  } else if (priceChange < -5 && oiChange < -10) {
    scenario = "PANIC_LIQUIDATION"; signal = "LONG"; confidence = 0.8;
  } else if (Math.abs(priceChange) < 3 && oiChange > 5 && Math.abs(fundingRate) < 0.0003) {
    scenario = "ACCUMULATION"; signal = "LONG"; confidence = 0.75;
  }

  return { scenario, signal, confidence, priceChange, oiChange, fundingRate };
}

export async function detectWyckoffPhase(symbol = "BTC/USDT"): Promise<WyckoffPhase> {
  const { candles } = await getCandles(symbol, "1h", 168);
  if (candles.length < 50) {
    return { phase: "UNKNOWN", signal: "NEUTRAL", confidence: 0, priceVolatility: 0, volumeTrend: "unknown", whaleActivity: "unknown" };
  }

  const prices = candles.map((c) => c.close);
  const returns = prices.slice(1).map((p, i) => (prices[i] > 0 ? (p - prices[i]) / prices[i] : 0));
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length;
  const volatility = Math.sqrt(variance) * 100;

  const volumes = candles.map((c) => c.volume);
  const recentVolume = volumes.slice(-24).reduce((sum, v) => sum + v, 0) / 24;
  const oldVolume = volumes.slice(0, 24).reduce((sum, v) => sum + v, 0) / 24;
  const volumeTrend = recentVolume > oldVolume * 1.2 ? "increasing" : recentVolume < oldVolume * 0.8 ? "decreasing" : "stable";

  const oldPrice = prices[0];
  const recentPrice = prices[prices.length - 1];
  const priceChange = oldPrice > 0 ? ((recentPrice - oldPrice) / oldPrice) * 100 : 0;

  let phase: WyckoffPhase["phase"] = "UNKNOWN";
  let signal: WyckoffPhase["signal"] = "NEUTRAL";
  let confidence = 0.5;

  if (volatility < 2 && volumeTrend === "decreasing" && Math.abs(priceChange) < 5) {
    phase = "ACCUMULATION"; signal = "LONG"; confidence = 0.7;
  } else if (priceChange > 10 && volumeTrend === "increasing") {
    phase = "MARKUP"; signal = "LONG"; confidence = 0.8;
  } else if (volatility < 2 && volumeTrend === "decreasing" && priceChange > 15) {
    phase = "DISTRIBUTION"; signal = "SHORT"; confidence = 0.7;
  } else if (priceChange < -10 && volumeTrend === "increasing") {
    phase = "MARKDOWN"; signal = "SHORT"; confidence = 0.8;
  }

  return { phase, signal, confidence, priceVolatility: volatility, volumeTrend, whaleActivity: "estimated" };
}

export async function analyzeMarketMicrostructure(symbol = "BTC/USDT"): Promise<MarketMicrostructure> {
  const [trades, takerRatio] = await Promise.all([getAggTrades(symbol, 200), getTakerRatio(symbol, "5m", 12)]);
  if (trades.length === 0) {
    return { cvdDivergence: false, orderbookAsymmetry: 0, largeTradeDirection: "NEUTRAL", largeTradeCount: 0, signal: "NEUTRAL" };
  }

  let cvd = 0;
  for (const t of trades) {
    const vol = parseFloat(t.q) * parseFloat(t.p);
    cvd += t.m ? -vol : vol;
  }

  const largeTrades = trades.filter((t) => parseFloat(t.q) * parseFloat(t.p) > 100_000);
  const largeBuys = largeTrades.filter((t) => !t.m).length;
  const largeSells = largeTrades.filter((t) => t.m).length;
  const largeTradeDirection: MarketMicrostructure["largeTradeDirection"] = largeBuys > largeSells ? "BUY" : largeSells > largeBuys ? "SELL" : "NEUTRAL";

  const avgTaker = takerRatio.length > 0 ? takerRatio.reduce((sum, r) => sum + parseFloat(r.buySellRatio), 0) / takerRatio.length : 1;
  const orderbookAsymmetry = (avgTaker - 1) / 2;
  const priceChange = parseFloat(trades[trades.length - 1].p) - parseFloat(trades[0].p);
  const cvdDivergence = (cvd > 0 && priceChange < 0) || (cvd < 0 && priceChange > 0);

  let signal: MarketMicrostructure["signal"] = "NEUTRAL";
  if (cvd > 0 && largeTradeDirection === "BUY") signal = "LONG";
  else if (cvd < 0 && largeTradeDirection === "SELL") signal = "SHORT";

  return { cvdDivergence, orderbookAsymmetry, largeTradeDirection, largeTradeCount: largeTrades.length, signal };
}
