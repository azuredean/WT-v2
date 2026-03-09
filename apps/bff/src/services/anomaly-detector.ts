/**
 * Multi-Layer Anomaly Detector
 *
 * Layer 1: Data source validation (null checks, timestamp continuity, price range)
 * Layer 2: Statistical anomaly detection (Z-score, IQR method)
 * Layer 3: Market microstructure (volume spikes, spread anomalies)
 *
 * Returns anomaly flags, a clean/suspicious status, and data quality score.
 */

import { getCandles, getTicker, type Candle, type TickerData } from "./data-provider.js";
import { clamp } from "./signal-engine.js";

async function fetchCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
  const { candles } = await getCandles(symbol, timeframe, limit);
  return candles;
}

async function fetchTicker(symbol: string): Promise<TickerData> {
  return getTicker(symbol);
}

// TickerEntry alias for backward compat within this file
type TickerEntry = TickerData;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnomalyStatus = "clean" | "suspicious" | "critical";

export interface AnomalyFlag {
  layer: 1 | 2 | 3;
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  value?: number;
  threshold?: number;
}

export interface DataQualityReport {
  /** Overall status */
  status: AnomalyStatus;
  /** 0-1 quality score (1 = perfect quality) */
  score: number;
  /** Individual anomaly flags */
  flags: AnomalyFlag[];
  /** Number of data points analyzed */
  dataPoints: number;
  /** Timestamp of the report */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Layer 1: Data source validation
// ---------------------------------------------------------------------------

interface Layer1Result {
  flags: AnomalyFlag[];
  score: number; // 0-1 partial score
}

function layer1Validation(
  candles: Candle[],
  ticker: TickerEntry,
): Layer1Result {
  const flags: AnomalyFlag[] = [];
  let score = 1.0;

  // Check 1: Null / empty data
  if (candles.length === 0) {
    flags.push({
      layer: 1,
      type: "no_candle_data",
      severity: "high",
      message: "No candle data available from exchange",
    });
    score -= 0.5;
  }

  // ticker is always defined (data-provider provides fallback)

  if (candles.length < 10) {
    flags.push({
      layer: 1,
      type: "insufficient_data",
      severity: "medium",
      message: `Only ${candles.length} candles available (need 10+ for reliable analysis)`,
      value: candles.length,
      threshold: 10,
    });
    score -= 0.2;
  }

  // Check 2: Timestamp continuity
  if (candles.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      intervals.push(candles[i].time - candles[i - 1].time);
    }

    // Expected interval: mode of intervals
    const intervalCounts = new Map<number, number>();
    for (const interval of intervals) {
      intervalCounts.set(interval, (intervalCounts.get(interval) ?? 0) + 1);
    }
    let expectedInterval = intervals[0];
    let maxCount = 0;
    for (const [interval, count] of intervalCounts) {
      if (count > maxCount) {
        maxCount = count;
        expectedInterval = interval;
      }
    }

    // Count gaps (intervals that differ from expected by > 10%)
    const gaps = intervals.filter(
      (iv) => Math.abs(iv - expectedInterval) > expectedInterval * 0.1,
    );

    if (gaps.length > 0) {
      const gapRatio = gaps.length / intervals.length;
      flags.push({
        layer: 1,
        type: "timestamp_gaps",
        severity: gapRatio > 0.1 ? "high" : "low",
        message: `${gaps.length} timestamp gaps detected in ${intervals.length} intervals (${(gapRatio * 100).toFixed(1)}%)`,
        value: gaps.length,
        threshold: 0,
      });
      score -= gapRatio * 0.3;
    }
  }

  // Check 3: Price range sanity
  if (candles.length > 0 && ticker) {
    const currentPrice = ticker.price;
    const lastCandleClose = candles[candles.length - 1].close;

    // Current price should be within 5% of the last candle close
    const priceDivergence = Math.abs(currentPrice - lastCandleClose) / lastCandleClose;
    if (priceDivergence > 0.05) {
      flags.push({
        layer: 1,
        type: "price_divergence",
        severity: "medium",
        message: `Current price $${currentPrice.toFixed(2)} diverges ${(priceDivergence * 100).toFixed(1)}% from last candle close $${lastCandleClose.toFixed(2)}`,
        value: priceDivergence,
        threshold: 0.05,
      });
      score -= 0.15;
    }

    // Check for zero or negative prices
    const invalidPrices = candles.filter(
      (c) => c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0,
    );
    if (invalidPrices.length > 0) {
      flags.push({
        layer: 1,
        type: "invalid_prices",
        severity: "high",
        message: `${invalidPrices.length} candles with zero or negative prices`,
        value: invalidPrices.length,
      });
      score -= 0.4;
    }

    // Check for OHLC consistency (high >= open, close, low; low <= open, close)
    const inconsistent = candles.filter(
      (c) => c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close),
    );
    if (inconsistent.length > 0) {
      flags.push({
        layer: 1,
        type: "ohlc_inconsistency",
        severity: "medium",
        message: `${inconsistent.length} candles with OHLC inconsistency (high < body or low > body)`,
        value: inconsistent.length,
      });
      score -= 0.1;
    }
  }

  // Check 4: Volume sanity
  const zeroVolCandles = candles.filter((c) => c.volume === 0);
  if (zeroVolCandles.length > candles.length * 0.1) {
    flags.push({
      layer: 1,
      type: "zero_volume",
      severity: "medium",
      message: `${zeroVolCandles.length} candles with zero volume (${((zeroVolCandles.length / candles.length) * 100).toFixed(1)}%)`,
      value: zeroVolCandles.length,
    });
    score -= 0.15;
  }

  return { flags, score: clamp(score, 0, 1) };
}

// ---------------------------------------------------------------------------
// Layer 2: Statistical anomaly detection
// ---------------------------------------------------------------------------

interface Layer2Result {
  flags: AnomalyFlag[];
  score: number;
}

function layer2StatisticalAnomaly(candles: Candle[]): Layer2Result {
  const flags: AnomalyFlag[] = [];
  let score = 1.0;

  if (candles.length < 20) {
    return { flags, score }; // Need enough data for statistical analysis
  }

  // --- Z-score analysis on returns ---
  const returns: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const ret = (candles[i].close - candles[i - 1].close) / candles[i - 1].close;
    returns.push(ret);
  }

  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(
    returns.reduce((acc, r) => acc + (r - meanReturn) ** 2, 0) / returns.length,
  );

  if (stdReturn > 0) {
    const zScores = returns.map((r) => Math.abs((r - meanReturn) / stdReturn));
    const extremeReturns = zScores.filter((z) => z > 3); // >3 sigma events

    if (extremeReturns.length > 0) {
      const maxZ = Math.max(...zScores);
      const severity = maxZ > 5 ? "high" : maxZ > 4 ? "medium" : "low";

      flags.push({
        layer: 2,
        type: "extreme_returns",
        severity,
        message: `${extremeReturns.length} extreme price movements detected (max Z-score: ${maxZ.toFixed(2)})`,
        value: maxZ,
        threshold: 3.0,
      });

      if (extremeReturns.length > returns.length * 0.05) {
        score -= 0.2; // Too many extreme events
      }
    }
  }

  // --- IQR analysis on volume ---
  const volumes = candles.map((c) => c.volume).sort((a, b) => a - b);
  const q1Index = Math.floor(volumes.length * 0.25);
  const q3Index = Math.floor(volumes.length * 0.75);
  const q1 = volumes[q1Index];
  const q3 = volumes[q3Index];
  const iqr = q3 - q1;

  if (iqr > 0) {
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const volumeOutliers = candles.filter(
      (c) => c.volume < lowerBound || c.volume > upperBound,
    );

    if (volumeOutliers.length > candles.length * 0.1) {
      flags.push({
        layer: 2,
        type: "volume_outliers",
        severity: "medium",
        message: `${volumeOutliers.length} volume outliers detected (IQR method, ${((volumeOutliers.length / candles.length) * 100).toFixed(1)}% of candles)`,
        value: volumeOutliers.length,
        threshold: Math.floor(candles.length * 0.1),
      });
      score -= 0.1;
    }
  }

  // --- Check for price distribution anomalies ---
  // If more than 50% of candles close at the same price, suspicious
  const closePrices = candles.map((c) => c.close);
  const priceFreq = new Map<number, number>();
  for (const p of closePrices) {
    priceFreq.set(p, (priceFreq.get(p) ?? 0) + 1);
  }
  const maxFreq = Math.max(...priceFreq.values());
  if (maxFreq > candles.length * 0.3) {
    flags.push({
      layer: 2,
      type: "price_clustering",
      severity: "medium",
      message: `Price clustering detected: ${maxFreq} candles close at the same price`,
      value: maxFreq,
    });
    score -= 0.15;
  }

  return { flags, score: clamp(score, 0, 1) };
}

// ---------------------------------------------------------------------------
// Layer 3: Market microstructure anomalies
// ---------------------------------------------------------------------------

interface Layer3Result {
  flags: AnomalyFlag[];
  score: number;
}

function layer3Microstructure(candles: Candle[]): Layer3Result {
  const flags: AnomalyFlag[] = [];
  let score = 1.0;

  if (candles.length < 10) {
    return { flags, score };
  }

  // --- Volume spike detection ---
  const avgVolume = candles.reduce((a, c) => a + c.volume, 0) / candles.length;
  const recentCandles = candles.slice(-5);

  for (const candle of recentCandles) {
    if (candle.volume > avgVolume * 10) {
      flags.push({
        layer: 3,
        type: "extreme_volume_spike",
        severity: "high",
        message: `Extreme volume spike: ${(candle.volume / avgVolume).toFixed(1)}x average at ${new Date(candle.time).toISOString()}`,
        value: candle.volume / avgVolume,
        threshold: 10,
      });
      score -= 0.15;
    } else if (candle.volume > avgVolume * 5) {
      flags.push({
        layer: 3,
        type: "volume_spike",
        severity: "medium",
        message: `Volume spike: ${(candle.volume / avgVolume).toFixed(1)}x average at ${new Date(candle.time).toISOString()}`,
        value: candle.volume / avgVolume,
        threshold: 5,
      });
      score -= 0.05;
    }
  }

  // --- Spread anomaly (high - low vs close) ---
  const spreads = candles.map((c) => (c.high - c.low) / c.close);
  const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
  const stdSpread = Math.sqrt(
    spreads.reduce((acc, s) => acc + (s - avgSpread) ** 2, 0) / spreads.length,
  );

  // Check recent candles for extreme spreads
  const recentSpreads = spreads.slice(-5);
  for (let i = 0; i < recentSpreads.length; i++) {
    if (stdSpread > 0 && recentSpreads[i] > avgSpread + 3 * stdSpread) {
      flags.push({
        layer: 3,
        type: "spread_anomaly",
        severity: "medium",
        message: `Abnormally wide spread: ${(recentSpreads[i] * 100).toFixed(2)}% (avg: ${(avgSpread * 100).toFixed(2)}%)`,
        value: recentSpreads[i],
        threshold: avgSpread + 3 * stdSpread,
      });
      score -= 0.1;
    }
  }

  // --- Consecutive same-direction candles (trend exhaustion warning) ---
  const recentCloses = candles.slice(-20).map((c) => c.close);
  let consecutiveSame = 1;
  let maxConsecutive = 1;
  for (let i = 1; i < recentCloses.length; i++) {
    const prevDir = recentCloses[i - 1] > (i >= 2 ? recentCloses[i - 2] : recentCloses[i - 1]);
    const currDir = recentCloses[i] > recentCloses[i - 1];
    if (currDir === prevDir) {
      consecutiveSame++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveSame);
    } else {
      consecutiveSame = 1;
    }
  }

  if (maxConsecutive >= 8) {
    flags.push({
      layer: 3,
      type: "trend_exhaustion",
      severity: "low",
      message: `${maxConsecutive} consecutive same-direction candles detected (potential trend exhaustion)`,
      value: maxConsecutive,
      threshold: 8,
    });
    // Not necessarily an anomaly, just informational
  }

  // --- Gap detection: significant price gap between candle close and next open ---
  for (let i = 1; i < candles.length; i++) {
    const gap = Math.abs(candles[i].open - candles[i - 1].close) / candles[i - 1].close;
    if (gap > 0.02) {
      // >2% gap
      flags.push({
        layer: 3,
        type: "price_gap",
        severity: gap > 0.05 ? "high" : "medium",
        message: `Price gap of ${(gap * 100).toFixed(2)}% at ${new Date(candles[i].time).toISOString()}`,
        value: gap,
        threshold: 0.02,
      });
      score -= gap > 0.05 ? 0.15 : 0.05;
    }
  }

  return { flags, score: clamp(score, 0, 1) };
}

// ---------------------------------------------------------------------------
// Main anomaly detection pipeline
// ---------------------------------------------------------------------------

export async function detectAnomalies(
  symbol: string = "BTC/USDT",
  timeframe: string = "5m",
  limit: number = 100,
): Promise<DataQualityReport> {
  const [candles, ticker] = await Promise.all([
    fetchCandles(symbol, timeframe, limit),
    fetchTicker(symbol),
  ]);

  // Run all three layers
  const l1 = layer1Validation(candles, ticker);
  const l2 = layer2StatisticalAnomaly(candles);
  const l3 = layer3Microstructure(candles);

  // Combine flags
  const allFlags = [...l1.flags, ...l2.flags, ...l3.flags];

  // Compute overall score (weighted average of layer scores)
  const overallScore = clamp(
    l1.score * 0.4 + l2.score * 0.3 + l3.score * 0.3,
    0,
    1,
  );

  // Determine status
  let status: AnomalyStatus = "clean";
  const highFlags = allFlags.filter((f) => f.severity === "high");
  const mediumFlags = allFlags.filter((f) => f.severity === "medium");

  if (highFlags.length >= 2 || overallScore < 0.5) {
    status = "critical";
  } else if (highFlags.length >= 1 || mediumFlags.length >= 3 || overallScore < 0.75) {
    status = "suspicious";
  }

  return {
    status,
    score: Math.round(overallScore * 100) / 100,
    flags: allFlags,
    dataPoints: candles.length,
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Standalone data quality score (fast, for use in signal engine)
// ---------------------------------------------------------------------------

export async function computeDataQualityScore(
  symbol: string = "BTC/USDT",
): Promise<number> {
  const report = await detectAnomalies(symbol, "5m", 50);
  return report.score;
}
