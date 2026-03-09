import { getCandles } from "./data-provider.js";

export interface DataQualityCheck {
  passed: boolean;
  reason?: string;
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

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  anomalyType: AnomalyType[];
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  details: string;
}

export interface DataQualityScore {
  score: number;
  sourceCoverage: number;
  dataFreshness: number;
  crossValidation: number;
  anomalyFree: number;
  recommendation: "FULL_CONFIDENCE" | "REDUCE_POSITION" | "PAUSE_TRADING";
}

export interface CircuitBreakerStatus {
  triggered: boolean;
  reason: string;
  pauseDuration: number;
  triggeredAt?: number;
}

export class DataSourceValidator {
  static validate(data: unknown[]): DataQualityCheck {
    if (!Array.isArray(data) || data.length === 0) return { passed: false, reason: "Empty data" };
    const hasNull = data.some((d) => d == null);
    if (hasNull) return { passed: false, reason: "Null values detected" };
    return { passed: true };
  }
}

export class StatisticalAnomalyDetector {
  static detect(values: number[]): boolean[] {
    if (values.length < 10) return new Array(values.length).fill(false);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);
    if (std === 0) return new Array(values.length).fill(false);
    return values.map((v) => Math.abs((v - mean) / std) > 3);
  }
}

export class MarketMicrostructureDetector {
  static async detectFlashCrash(symbol: string, threshold = 0.05): Promise<AnomalyDetectionResult | null> {
    const { candles } = await getCandles(symbol, "1m", 10);
    if (candles.length < 3) return null;

    for (let i = 1; i < candles.length - 1; i++) {
      const prev = candles[i - 1].close;
      const currLow = candles[i].low;
      const currHigh = candles[i].high;
      const next = candles[i + 1].close;

      const drop = prev > 0 ? (prev - currLow) / prev : 0;
      const rec = currLow > 0 ? (next - currLow) / currLow : 0;
      if (drop > threshold && rec > threshold * 0.8) {
        return {
          isAnomaly: true,
          anomalyType: ["FLASH_CRASH"],
          severity: "HIGH",
          confidence: 0.9,
          details: `Flash crash detected: ${(drop * 100).toFixed(2)}% drop`,
        };
      }

      const pump = prev > 0 ? (currHigh - prev) / prev : 0;
      const fade = currHigh > 0 ? (currHigh - next) / currHigh : 0;
      if (pump > threshold && fade > threshold * 0.8) {
        return {
          isAnomaly: true,
          anomalyType: ["FLASH_CRASH"],
          severity: "HIGH",
          confidence: 0.9,
          details: `Flash pump detected: ${(pump * 100).toFixed(2)}% pump`,
        };
      }
    }
    return null;
  }

  static detectWashTrading(candles: Array<{ volume: number; open: number; close: number }>): AnomalyDetectionResult | null {
    if (candles.length < 5) return null;
    let suspicious = 0;
    for (const c of candles) {
      const body = Math.abs(c.close - c.open);
      if (c.volume > 0 && body / Math.max(Math.abs(c.open), 1) < 0.0001) suspicious++;
    }
    if (suspicious / candles.length > 0.6) {
      return {
        isAnomaly: true,
        anomalyType: ["WASH_TRADING"],
        severity: "MEDIUM",
        confidence: 0.7,
        details: `Possible wash trading: ${suspicious}/${candles.length} suspicious candles`,
      };
    }
    return null;
  }

  static async detectBlackSwan(symbol: string): Promise<AnomalyDetectionResult | null> {
    const { candles } = await getCandles(symbol, "1h", 24);
    if (candles.length < 24) return null;
    const first = candles[0].close;
    const last = candles[candles.length - 1].close;
    const move = first > 0 ? Math.abs((last - first) / first) : 0;
    if (move > 0.15) {
      return {
        isAnomaly: true,
        anomalyType: ["BLACK_SWAN"],
        severity: "CRITICAL",
        confidence: 0.95,
        details: `Black swan event: ${(move * 100).toFixed(2)}% move in 24h`,
      };
    }
    return null;
  }
}

export async function calculateDataQualityScore(symbol = "BTC/USDT"): Promise<DataQualityScore> {
  const { candles } = await getCandles(symbol, "5m", 12);
  const sourceCoverage = 1;
  const now = Date.now();
  const latest = candles.length > 0 ? candles[candles.length - 1].time : 0;
  const delaySec = latest > 0 ? (now - latest) / 1000 : 60;
  const dataFreshness = Math.max(0, 1 - delaySec / 60);
  const crossValidation = DataSourceValidator.validate(candles).passed ? 1 : 0;
  const prices = candles.map((c) => c.close);
  const anomalyFlags = StatisticalAnomalyDetector.detect(prices);
  const anomalyRatio = anomalyFlags.length > 0 ? anomalyFlags.filter(Boolean).length / anomalyFlags.length : 1;
  const anomalyFree = 1 - anomalyRatio;

  const score = sourceCoverage * 0.25 + dataFreshness * 0.25 + crossValidation * 0.25 + anomalyFree * 0.25;
  const recommendation: DataQualityScore["recommendation"] = score >= 0.85 ? "FULL_CONFIDENCE" : score >= 0.7 ? "REDUCE_POSITION" : "PAUSE_TRADING";

  return {
    score: Math.round(score * 100) / 100,
    sourceCoverage,
    dataFreshness: Math.round(dataFreshness * 100) / 100,
    crossValidation,
    anomalyFree: Math.round(anomalyFree * 100) / 100,
    recommendation,
  };
}

export class CircuitBreaker {
  private static triggers = new Map<string, CircuitBreakerStatus>();

  static async check(symbol: string): Promise<CircuitBreakerStatus> {
    const existing = this.triggers.get(symbol);
    if (existing?.triggered) {
      const elapsed = (Date.now() - (existing.triggeredAt ?? 0)) / 1000 / 3600;
      if (elapsed < existing.pauseDuration) return existing;
      this.triggers.delete(symbol);
    }

    const [{ candles }, dqs, flash, black] = await Promise.all([
      getCandles(symbol, "1h", 24),
      calculateDataQualityScore(symbol),
      MarketMicrostructureDetector.detectFlashCrash(symbol),
      MarketMicrostructureDetector.detectBlackSwan(symbol),
    ]);

    if (candles.length >= 24) {
      const first = candles[0].close;
      const last = candles[candles.length - 1].close;
      const drop = first > 0 ? (first - last) / first : 0;
      if (drop > 0.15) {
        const status = { triggered: true, reason: `Market dropped ${(drop * 100).toFixed(2)}% in 24h`, pauseDuration: 24, triggeredAt: Date.now() };
        this.triggers.set(symbol, status);
        return status;
      }
    }

    if (dqs.score < 0.5) {
      const status = { triggered: true, reason: `Data quality score too low: ${dqs.score}`, pauseDuration: 1, triggeredAt: Date.now() };
      this.triggers.set(symbol, status);
      return status;
    }

    if (flash && flash.severity === "HIGH") {
      const status = { triggered: true, reason: flash.details, pauseDuration: 2, triggeredAt: Date.now() };
      this.triggers.set(symbol, status);
      return status;
    }

    if (black && black.severity === "CRITICAL") {
      const status = { triggered: true, reason: black.details, pauseDuration: 48, triggeredAt: Date.now() };
      this.triggers.set(symbol, status);
      return status;
    }

    return { triggered: false, reason: "", pauseDuration: 0 };
  }

  static reset(symbol: string): void {
    this.triggers.delete(symbol);
  }
}

export async function detectAnomalies(symbol = "BTC/USDT"): Promise<AnomalyDetectionResult[]> {
  const anomalies: AnomalyDetectionResult[] = [];
  const { candles } = await getCandles(symbol, "5m", 12);

  const validation = DataSourceValidator.validate(candles);
  if (!validation.passed) {
    anomalies.push({
      isAnomaly: true,
      anomalyType: ["DATA_SOURCE_FAILURE"],
      severity: "HIGH",
      confidence: 1,
      details: validation.reason ?? "Data validation failed",
    });
  }

  const prices = candles.map((c) => c.close);
  const statFlags = StatisticalAnomalyDetector.detect(prices);
  const anomalyCount = statFlags.filter(Boolean).length;
  if (prices.length > 0 && anomalyCount > prices.length * 0.2) {
    anomalies.push({
      isAnomaly: true,
      anomalyType: ["STATISTICAL_OUTLIER"],
      severity: "MEDIUM",
      confidence: 0.8,
      details: `${anomalyCount} statistical outliers detected in ${prices.length} data points`,
    });
  }

  const flash = await MarketMicrostructureDetector.detectFlashCrash(symbol);
  if (flash) anomalies.push(flash);

  const wash = MarketMicrostructureDetector.detectWashTrading(candles);
  if (wash) anomalies.push(wash);

  const black = await MarketMicrostructureDetector.detectBlackSwan(symbol);
  if (black) anomalies.push(black);

  return anomalies;
}
