/**
 * Three-Layer Anomaly Detection Framework
 * 
 * Layer 1: Data Source Level - Validate raw data quality
 * Layer 2: Statistical Level - Detect statistical outliers
 * Layer 3: Market Microstructure Level - Detect manipulation patterns
 */

import { getCandles, getTicker, type Kline } from "./data-provider.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataQualityCheck {
  passed: boolean;
  reason?: string;
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  anomalyType: AnomalyType[];
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  details: string;
}

export type AnomalyType =
  | "FLASH_CRASH"
  | "EXCHANGE_OUTAGE"
  | "WASH_TRADING"
  | "SPOOFING"
  | "DATA_SOURCE_FAILURE"
  | "BLACK_SWAN"
  | "WHALE_ANOMALY"
  | "STATISTICAL_OUTLIER";

export interface DataQualityScore {
  score: number; // 0-1
  sourceCoverage: number;
  dataFreshness: number;
  crossValidation: number;
  anomalyFree: number;
  recommendation: "FULL_CONFIDENCE" | "REDUCE_POSITION" | "PAUSE_TRADING";
}

export interface CircuitBreakerStatus {
  triggered: boolean;
  reason: string;
  pauseDuration: number; // hours
  triggeredAt?: number;
}

// ---------------------------------------------------------------------------
// Layer 1: Data Source Validation
// ---------------------------------------------------------------------------

export class DataSourceValidator {
  /**
   * Validate raw data quality
   */
  static validate(data: any[]): DataQualityCheck {
    // Check for null values
    const nullCheck = this.checkNullValues(data);
    if (!nullCheck.passed) return nullCheck;

    // Check timestamp continuity
    const timestampCheck = this.checkTimestampContinuity(data);
    if (!timestampCheck.passed) return timestampCheck;

    // Check price range sanity
    const priceCheck = this.checkPriceRange(data);
    if (!priceCheck.passed) return priceCheck;

    // Check volume sanity
    const volumeCheck = this.checkVolumeSanity(data);
    if (!volumeCheck.passed) return volumeCheck;

    return { passed: true };
  }

  private static checkNullValues(data: any[]): DataQualityCheck {
    if (!data || data.length === 0) {
      return { passed: false, reason: "Empty data" };
    }

    const hasNull = data.some(d => 
      d === null || 
      d === undefined ||
      (typeof d === 'object' && Object.values(d).some(v => v === null || v === undefined))
    );

    if (hasNull) {
      return { passed: false, reason: "Null values detected" };
    }

    return { passed: true };
  }

  private static checkTimestampContinuity(data: any[]): DataQualityCheck {
    if (data.length < 2) return { passed: true };

    // Check if data has timestamp field
    const hasTimestamp = data.every(d => 
      d.timestamp !== undefined || 
      d.openTime !== undefined ||
      d.T !== undefined
    );

    if (!hasTimestamp) {
      return { passed: false, reason: "Missing timestamp" };
    }

    // Check for gaps (simplified check)
    for (let i = 1; i < Math.min(data.length, 10); i++) {
      const t1 = data[i - 1].timestamp || data[i - 1].openTime || data[i - 1].T;
      const t2 = data[i].timestamp || data[i].openTime || data[i].T;
      
      if (t2 <= t1) {
        return { passed: false, reason: "Timestamp not monotonic" };
      }
    }

    return { passed: true };
  }

  private static checkPriceRange(data: any[]): DataQualityCheck {
    const prices = data
      .map(d => parseFloat(d.close || d.price || d.p || 0))
      .filter(p => p > 0);

    if (prices.length === 0) {
      return { passed: false, reason: "No valid prices" };
    }

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Check for unrealistic price range (>50% in single dataset)
    if (maxPrice / minPrice > 1.5) {
      return { passed: false, reason: "Unrealistic price range" };
    }

    return { passed: true };
  }

  private static checkVolumeSanity(data: any[]): DataQualityCheck {
    const volumes = data
      .map(d => parseFloat(d.volume || d.v || 0))
      .filter(v => v >= 0);

    if (volumes.length === 0) {
      return { passed: false, reason: "No valid volumes" };
    }

    // Check for all-zero volumes
    if (volumes.every(v => v === 0)) {
      return { passed: false, reason: "All volumes are zero" };
    }

    return { passed: true };
  }
}

// ---------------------------------------------------------------------------
// Layer 2: Statistical Anomaly Detection
// ---------------------------------------------------------------------------

export class StatisticalAnomalyDetector {
  /**
   * Detect anomalies using multiple statistical methods
   * Returns true if at least 2 out of 3 methods agree
   */
  static detect(timeSeries: number[]): boolean[] {
    if (timeSeries.length < 10) {
      return new Array(timeSeries.length).fill(false);
    }

    const zScoreAnomalies = this.detectZScore(timeSeries);
    const iqrAnomalies = this.detectIQR(timeSeries);
    const rollingAnomalies = this.detectRollingOutliers(timeSeries);

    // Consensus: at least 2/3 methods must agree
    const consensus = timeSeries.map((_, i) => {
      const votes = 
        (zScoreAnomalies[i] ? 1 : 0) +
        (iqrAnomalies[i] ? 1 : 0) +
        (rollingAnomalies[i] ? 1 : 0);
      return votes >= 2;
    });

    return consensus;
  }

  /**
   * Z-Score method: detect values >3 standard deviations from mean
   */
  private static detectZScore(data: number[], threshold = 3.0): boolean[] {
    const mean = data.reduce((sum, v) => sum + v, 0) / data.length;
    const variance = data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / data.length;
    const std = Math.sqrt(variance);

    if (std === 0) return new Array(data.length).fill(false);

    return data.map(v => Math.abs((v - mean) / std) > threshold);
  }

  /**
   * IQR method: detect values outside Q1 - 3*IQR or Q3 + 3*IQR
   */
  private static detectIQR(data: number[], multiplier = 3.0): boolean[] {
    const sorted = [...data].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    const lowerBound = q1 - multiplier * iqr;
    const upperBound = q3 + multiplier * iqr;

    return data.map(v => v < lowerBound || v > upperBound);
  }

  /**
   * Rolling window method: detect outliers using rolling statistics
   */
  private static detectRollingOutliers(
    data: number[],
    window = 20,
    threshold = 3.5
  ): boolean[] {
    const anomalies = new Array(data.length).fill(false);

    for (let i = window; i < data.length; i++) {
      const windowData = data.slice(i - window, i);
      const mean = windowData.reduce((sum, v) => sum + v, 0) / window;
      const variance = windowData.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / window;
      const std = Math.sqrt(variance);

      if (std > 0 && Math.abs((data[i] - mean) / std) > threshold) {
        anomalies[i] = true;
      }
    }

    return anomalies;
  }
}

// ---------------------------------------------------------------------------
// Layer 3: Market Microstructure Anomaly Detection
// ---------------------------------------------------------------------------

export class MarketMicrostructureDetector {
  /**
   * Detect flash crash: >5% price move in 1 minute with quick recovery
   */
  static async detectFlashCrash(
    symbol: string,
    threshold = 0.05
  ): Promise<AnomalyDetectionResult | null> {
    const candles = await getCandles(symbol, "1m", 10);
    
    if (candles.length < 3) return null;

    for (let i = 1; i < candles.length - 1; i++) {
      const prevClose = parseFloat(candles[i - 1].close);
      const currLow = parseFloat(candles[i].low);
      const currHigh = parseFloat(candles[i].high);
      const nextClose = parseFloat(candles[i + 1].close);

      const dropPercent = (prevClose - currLow) / prevClose;
      const recoveryPercent = (nextClose - currLow) / currLow;

      // Flash crash: >5% drop with >80% recovery in next candle
      if (dropPercent > threshold && recoveryPercent > threshold * 0.8) {
        return {
          isAnomaly: true,
          anomalyType: ["FLASH_CRASH"],
          severity: "HIGH",
          confidence: 0.9,
          details: `Flash crash detected: ${(dropPercent * 100).toFixed(2)}% drop with ${(recoveryPercent * 100).toFixed(2)}% recovery`,
        };
      }

      // Also check for flash pump
      const pumpPercent = (currHigh - prevClose) / prevClose;
      const dropbackPercent = (currHigh - nextClose) / currHigh;

      if (pumpPercent > threshold && dropbackPercent > threshold * 0.8) {
        return {
          isAnomaly: true,
          anomalyType: ["FLASH_CRASH"],
          severity: "HIGH",
          confidence: 0.9,
          details: `Flash pump detected: ${(pumpPercent * 100).toFixed(2)}% pump with ${(dropbackPercent * 100).toFixed(2)}% dropback`,
        };
      }
    }

    return null;
  }

  /**
   * Detect wash trading: symmetric buy/sell volumes
   */
  static detectWashTrading(candles: Kline[]): AnomalyDetectionResult | null {
    if (candles.length < 5) return null;

    // Check for suspiciously symmetric volumes
    let symmetricCount = 0;

    for (const candle of candles) {
      const volume = parseFloat(candle.volume);
      const takerBuyVolume = parseFloat(candle.takerBuyBaseAssetVolume || "0");
      const takerSellVolume = volume - takerBuyVolume;

      if (takerBuyVolume > 0 && takerSellVolume > 0) {
        const ratio = Math.min(takerBuyVolume, takerSellVolume) / Math.max(takerBuyVolume, takerSellVolume);
        
        // If buy/sell volumes are within 5% of each other
        if (ratio > 0.95) {
          symmetricCount++;
        }
      }
    }

    // If >60% of candles show symmetric trading
    if (symmetricCount / candles.length > 0.6) {
      return {
        isAnomaly: true,
        anomalyType: ["WASH_TRADING"],
        severity: "MEDIUM",
        confidence: 0.7,
        details: `Possible wash trading: ${symmetricCount}/${candles.length} candles show symmetric buy/sell`,
      };
    }

    return null;
  }

  /**
   * Detect black swan event: extreme market-wide volatility
   */
  static async detectBlackSwan(symbol: string): Promise<AnomalyDetectionResult | null> {
    const candles = await getCandles(symbol, "1h", 24);
    
    if (candles.length < 24) return null;

    const prices = candles.map(c => parseFloat(c.close));
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const priceChange = Math.abs((lastPrice - firstPrice) / firstPrice);

    // Black swan: >15% move in 24h
    if (priceChange > 0.15) {
      return {
        isAnomaly: true,
        anomalyType: ["BLACK_SWAN"],
        severity: "CRITICAL",
        confidence: 0.95,
        details: `Black swan event: ${(priceChange * 100).toFixed(2)}% move in 24h`,
      };
    }

    return null;
  }
}

// ---------------------------------------------------------------------------
// Data Quality Score (DQS) Calculation
// ---------------------------------------------------------------------------

export async function calculateDataQualityScore(
  symbol: string = "BTC/USDT"
): Promise<DataQualityScore> {
  const [candles, ticker] = await Promise.all([
    getCandles(symbol, "5m", 12),
    getTicker(symbol),
  ]);

  // 1. Source coverage (simplified: assume 1 source = Binance)
  const sourceCoverage = 1.0; // Would check multiple exchanges in production

  // 2. Data freshness (check if data is recent)
  const now = Date.now();
  const latestTimestamp = candles.length > 0 
    ? parseInt(candles[candles.length - 1].closeTime)
    : 0;
  const dataDelay = (now - latestTimestamp) / 1000; // seconds
  const dataFreshness = Math.max(0, 1.0 - dataDelay / 60); // 1.0 if <60s old

  // 3. Cross-validation (check data consistency)
  const validation = DataSourceValidator.validate(candles);
  const crossValidation = validation.passed ? 1.0 : 0.0;

  // 4. Anomaly-free ratio
  const prices = candles.map(c => parseFloat(c.close));
  const anomalies = StatisticalAnomalyDetector.detect(prices);
  const anomalyRatio = anomalies.filter(a => a).length / anomalies.length;
  const anomalyFree = 1.0 - anomalyRatio;

  // Calculate weighted score
  const score = 
    sourceCoverage * 0.25 +
    dataFreshness * 0.25 +
    crossValidation * 0.25 +
    anomalyFree * 0.25;

  // Recommendation
  let recommendation: DataQualityScore["recommendation"];
  if (score >= 0.85) {
    recommendation = "FULL_CONFIDENCE";
  } else if (score >= 0.7) {
    recommendation = "REDUCE_POSITION";
  } else {
    recommendation = "PAUSE_TRADING";
  }

  return {
    score: Math.round(score * 100) / 100,
    sourceCoverage,
    dataFreshness: Math.round(dataFreshness * 100) / 100,
    crossValidation,
    anomalyFree: Math.round(anomalyFree * 100) / 100,
    recommendation,
  };
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

export class CircuitBreaker {
  private static triggers: Map<string, CircuitBreakerStatus> = new Map();

  /**
   * Check if circuit breaker should be triggered
   */
  static async check(symbol: string): Promise<CircuitBreakerStatus> {
    // Check if already triggered
    const existing = this.triggers.get(symbol);
    if (existing && existing.triggered) {
      const elapsed = (Date.now() - (existing.triggeredAt || 0)) / 1000 / 3600; // hours
      if (elapsed < existing.pauseDuration) {
        return existing; // Still in cooldown
      } else {
        this.triggers.delete(symbol); // Cooldown expired
      }
    }

    // Check for trigger conditions
    const [candles, dqs, flashCrash, blackSwan] = await Promise.all([
      getCandles(symbol, "1h", 24),
      calculateDataQualityScore(symbol),
      MarketMicrostructureDetector.detectFlashCrash(symbol),
      MarketMicrostructureDetector.detectBlackSwan(symbol),
    ]);

    // Trigger 1: Market drop >15% in 24h
    if (candles.length >= 24) {
      const firstPrice = parseFloat(candles[0].close);
      const lastPrice = parseFloat(candles[candles.length - 1].close);
      const drop = (firstPrice - lastPrice) / firstPrice;

      if (drop > 0.15) {
        const status: CircuitBreakerStatus = {
          triggered: true,
          reason: `Market dropped ${(drop * 100).toFixed(2)}% in 24h`,
          pauseDuration: 24,
          triggeredAt: Date.now(),
        };
        this.triggers.set(symbol, status);
        return status;
      }
    }

    // Trigger 2: Data quality too low
    if (dqs.score < 0.5) {
      const status: CircuitBreakerStatus = {
        triggered: true,
        reason: `Data quality score too low: ${dqs.score}`,
        pauseDuration: 1,
        triggeredAt: Date.now(),
      };
      this.triggers.set(symbol, status);
      return status;
    }

    // Trigger 3: Flash crash detected
    if (flashCrash && flashCrash.severity === "HIGH") {
      const status: CircuitBreakerStatus = {
        triggered: true,
        reason: flashCrash.details,
        pauseDuration: 2,
        triggeredAt: Date.now(),
      };
      this.triggers.set(symbol, status);
      return status;
    }

    // Trigger 4: Black swan event
    if (blackSwan && blackSwan.severity === "CRITICAL") {
      const status: CircuitBreakerStatus = {
        triggered: true,
        reason: blackSwan.details,
        pauseDuration: 48,
        triggeredAt: Date.now(),
      };
      this.triggers.set(symbol, status);
      return status;
    }

    return { triggered: false, reason: "", pauseDuration: 0 };
  }

  /**
   * Manually reset circuit breaker
   */
  static reset(symbol: string): void {
    this.triggers.delete(symbol);
  }
}

// ---------------------------------------------------------------------------
// Comprehensive Anomaly Detection
// ---------------------------------------------------------------------------

export async function detectAnomalies(
  symbol: string = "BTC/USDT"
): Promise<AnomalyDetectionResult[]> {
  const anomalies: AnomalyDetectionResult[] = [];

  // Layer 1: Data source validation
  const candles = await getCandles(symbol, "5m", 12);
  const validation = DataSourceValidator.validate(candles);
  if (!validation.passed) {
    anomalies.push({
      isAnomaly: true,
      anomalyType: ["DATA_SOURCE_FAILURE"],
      severity: "HIGH",
      confidence: 1.0,
      details: validation.reason || "Data validation failed",
    });
  }

  // Layer 2: Statistical anomalies
  const prices = candles.map(c => parseFloat(c.close));
  const statAnomalies = StatisticalAnomalyDetector.detect(prices);
  const anomalyCount = statAnomalies.filter(a => a).length;
  if (anomalyCount > prices.length * 0.2) {
    anomalies.push({
      isAnomaly: true,
      anomalyType: ["STATISTICAL_OUTLIER"],
      severity: "MEDIUM",
      confidence: 0.8,
      details: `${anomalyCount} statistical outliers detected in ${prices.length} data points`,
    });
  }

  // Layer 3: Market microstructure
  const flashCrash = await MarketMicrostructureDetector.detectFlashCrash(symbol);
  if (flashCrash) {
    anomalies.push(flashCrash);
  }

  const washTrading = MarketMicrostructureDetector.detectWashTrading(candles);
  if (washTrading) {
    anomalies.push(washTrading);
  }

  const blackSwan = await MarketMicrostructureDetector.detectBlackSwan(symbol);
  if (blackSwan) {
    anomalies.push(blackSwan);
  }

  return anomalies;
}
