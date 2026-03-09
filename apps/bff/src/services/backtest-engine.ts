/**
 * Backtest Engine
 *
 * Runs historical backtests using the signal engine on Binance candle data.
 * Simulates trades based on fused signal strength, calculates performance
 * metrics including total return, max drawdown, Sharpe ratio, win rate,
 * and profit factor.
 */

import { getCandles, type Candle } from "./data-provider.js";
import { clamp, directionFromStrength, type Direction } from "./signal-engine.js";

async function fetchCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
  const { candles } = await getCandles(symbol, timeframe, limit);
  return candles;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BacktestConfig {
  symbol: string;
  timeframe: string;
  /** ISO date string or timestamp */
  startDate?: string;
  /** ISO date string or timestamp */
  endDate?: string;
  /** Number of candles to backtest (used if no startDate/endDate) */
  candleCount?: number;
  /** Initial capital in USDT */
  initialCapital: number;
  /** Strategies to enable (IDs). If empty, all are enabled. */
  enabledStrategies?: string[];
  /** Signal strength threshold to open a position (0-1) */
  entryThreshold?: number;
  /** Position size as fraction of capital (0-1) */
  positionSizeFraction?: number;
  /** Maximum leverage */
  maxLeverage?: number;
  /** Stop loss percentage (0-1, e.g. 0.02 = 2%) */
  stopLoss?: number;
  /** Take profit percentage (0-1, e.g. 0.05 = 5%) */
  takeProfit?: number;
}

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  direction: Direction;
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  pnlPercent: number;
  exitReason: "signal_reversal" | "stop_loss" | "take_profit" | "end_of_data";
}

export interface EquityCurvePoint {
  time: number;
  equity: number;
  drawdown: number;
  position: "long" | "short" | "flat";
}

export interface BacktestMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgHoldingPeriod: number;
  /** Annualized return */
  annualizedReturn: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  metrics: BacktestMetrics;
  equityCurve: EquityCurvePoint[];
  trades: BacktestTrade[];
  startTime: number;
  endTime: number;
  executionTimeMs: number;
}

// ---------------------------------------------------------------------------
// Simplified signal calculation for backtesting
// ---------------------------------------------------------------------------

/**
 * A simplified version of the signal engine that works with a window of candles
 * instead of making live API calls. This allows the backtest to run on historical
 * data without needing real-time API access for each candle.
 *
 * We implement a subset of the strategies that can be computed from candle data alone:
 * - S4 Liquidity Grab (volume + wick analysis)
 * - S5 OI Divergence (approximated from volume trends)
 * - S7 Stop Hunt (wick analysis)
 *
 * And supplement with data from Binance historical endpoints where available.
 */

interface SimplifiedSignal {
  direction: Direction;
  strength: number;
  confidence: number;
}

function computeCandleBasedSignal(
  candles: Candle[],
  index: number,
  windowSize: number = 20,
): SimplifiedSignal {
  if (index < windowSize) {
    return { direction: "neutral", strength: 0, confidence: 0 };
  }

  const window = candles.slice(index - windowSize, index + 1);
  const current = candles[index];

  let totalStrength = 0;
  let totalWeight = 0;

  // --- S4 style: Volume spike + stabilization ---
  const avgVolume = window.slice(0, -1).reduce((a, c) => a + c.volume, 0) / (window.length - 1);
  const volSpike = current.volume / (avgVolume || 1);

  if (volSpike > 3) {
    const isBearish = current.close < current.open;
    // After spike, signal opposite direction
    const s4Strength = isBearish ? 0.3 : -0.3;
    const s4Weight = clamp(volSpike / 5, 0.5, 1);
    totalStrength += s4Strength * s4Weight;
    totalWeight += s4Weight;
  }

  // --- S5 style: Price vs volume divergence ---
  const halfWindow = Math.floor(windowSize / 2);
  const recentWindow = window.slice(-halfWindow);
  const olderWindow = window.slice(0, halfWindow);

  const recentHighPrice = Math.max(...recentWindow.map((c) => c.high));
  const olderHighPrice = Math.max(...olderWindow.map((c) => c.high));
  const recentAvgVol = recentWindow.reduce((a, c) => a + c.volume, 0) / recentWindow.length;
  const olderAvgVol = olderWindow.reduce((a, c) => a + c.volume, 0) / olderWindow.length;

  const priceUp = recentHighPrice > olderHighPrice;
  const volUp = recentAvgVol > olderAvgVol * 1.1;

  if (priceUp && !volUp) {
    // Bearish divergence
    totalStrength += -0.3;
    totalWeight += 0.8;
  } else if (!priceUp && volUp) {
    // Bullish divergence (accumulation)
    totalStrength += 0.3;
    totalWeight += 0.8;
  }

  // --- S7 style: Stop hunt wick ---
  const totalRange = current.high - current.low;
  if (totalRange > 0) {
    const upperWick = current.high - Math.max(current.open, current.close);
    const lowerWick = Math.min(current.open, current.close) - current.low;

    if (lowerWick / totalRange > 0.6 && volSpike > 1.5) {
      totalStrength += 0.4;
      totalWeight += 0.7;
    } else if (upperWick / totalRange > 0.6 && volSpike > 1.5) {
      totalStrength += -0.4;
      totalWeight += 0.7;
    }
  }

  // --- Trend following component (moving average crossover) ---
  const shortMA = window.slice(-5).reduce((a, c) => a + c.close, 0) / 5;
  const longMA = window.reduce((a, c) => a + c.close, 0) / window.length;
  const maDiff = (shortMA - longMA) / longMA;

  const maStrength = clamp(maDiff / 0.01, -1, 1) * 0.3;
  totalStrength += maStrength;
  totalWeight += 0.6;

  // --- RSI component ---
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < window.length; i++) {
    const change = window[i].close - window[i - 1].close;
    if (change > 0) {
      gains.push(change);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(Math.abs(change));
    }
  }
  const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
  const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
  const rsi = 100 - 100 / (1 + rs);

  // RSI > 70 = overbought (short), RSI < 30 = oversold (long)
  if (rsi > 70) {
    totalStrength += -0.3 * ((rsi - 70) / 30);
    totalWeight += 0.5;
  } else if (rsi < 30) {
    totalStrength += 0.3 * ((30 - rsi) / 30);
    totalWeight += 0.5;
  }

  // Combine
  const strength = totalWeight > 0
    ? Math.round(clamp(totalStrength / totalWeight, -1, 1) * 100) / 100
    : 0;

  const confidence = Math.round(clamp(totalWeight / 3, 0, 1) * 100) / 100;
  const direction = directionFromStrength(strength);

  return { direction, strength, confidence };
}

// ---------------------------------------------------------------------------
// Backtest execution
// ---------------------------------------------------------------------------

const TF_TO_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  const startMs = Date.now();

  // Defaults
  const entryThreshold = config.entryThreshold ?? 0.3;
  const positionSizeFraction = config.positionSizeFraction ?? 0.5;
  const maxLeverage = config.maxLeverage ?? 3;
  const stopLoss = config.stopLoss ?? 0.03;
  const takeProfit = config.takeProfit ?? 0.06;
  const candleCount = config.candleCount ?? 500;

  // Fetch historical candles
  // Binance klines endpoint supports up to 1500 candles
  const limit = Math.min(candleCount, 1500);
  const candles = await fetchCandles(config.symbol, config.timeframe, limit);

  if (candles.length < 30) {
    throw new Error(`Insufficient candle data: got ${candles.length}, need at least 30`);
  }

  // State
  let equity = config.initialCapital;
  let peakEquity = equity;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  const trades: BacktestTrade[] = [];
  const equityCurve: EquityCurvePoint[] = [];
  const periodReturns: number[] = [];

  // Position state
  let inPosition = false;
  let posDirection: Direction = "neutral";
  let entryPrice = 0;
  let entryTime = 0;
  let positionSize = 0; // in USDT
  let positionQty = 0;  // in base asset

  const windowSize = 20;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const prevEquity = equity;

    // Compute signal for this candle
    const signal = computeCandleBasedSignal(candles, i, windowSize);

    if (inPosition) {
      // Check stop loss / take profit
      const currentPnlPercent =
        posDirection === "long"
          ? (candle.close - entryPrice) / entryPrice
          : (entryPrice - candle.close) / entryPrice;

      let exitReason: BacktestTrade["exitReason"] | null = null;
      let exitPrice = candle.close;

      // Check stop loss (use candle low/high for more realistic fill)
      if (posDirection === "long" && (candle.low - entryPrice) / entryPrice <= -stopLoss) {
        exitPrice = entryPrice * (1 - stopLoss);
        exitReason = "stop_loss";
      } else if (posDirection === "short" && (entryPrice - candle.high) / entryPrice <= -stopLoss) {
        exitPrice = entryPrice * (1 + stopLoss);
        exitReason = "stop_loss";
      }

      // Check take profit
      if (!exitReason) {
        if (posDirection === "long" && (candle.high - entryPrice) / entryPrice >= takeProfit) {
          exitPrice = entryPrice * (1 + takeProfit);
          exitReason = "take_profit";
        } else if (posDirection === "short" && (entryPrice - candle.low) / entryPrice >= takeProfit) {
          exitPrice = entryPrice * (1 - takeProfit);
          exitReason = "take_profit";
        }
      }

      // Check signal reversal
      if (!exitReason && signal.direction !== "neutral" && signal.direction !== posDirection && Math.abs(signal.strength) > entryThreshold) {
        exitPrice = candle.close;
        exitReason = "signal_reversal";
      }

      // End of data
      if (!exitReason && i === candles.length - 1) {
        exitPrice = candle.close;
        exitReason = "end_of_data";
      }

      if (exitReason) {
        // Close position
        const pnl =
          posDirection === "long"
            ? (exitPrice - entryPrice) * positionQty
            : (entryPrice - exitPrice) * positionQty;

        const pnlPercent =
          posDirection === "long"
            ? (exitPrice - entryPrice) / entryPrice
            : (entryPrice - exitPrice) / entryPrice;

        equity += pnl;

        trades.push({
          entryTime,
          exitTime: candle.time,
          direction: posDirection,
          entryPrice,
          exitPrice,
          size: positionSize,
          pnl: Math.round(pnl * 100) / 100,
          pnlPercent: Math.round(pnlPercent * 10000) / 10000,
          exitReason,
        });

        inPosition = false;
        posDirection = "neutral";
      }
    }

    // Open new position if not in one
    if (!inPosition && i < candles.length - 1 && Math.abs(signal.strength) > entryThreshold && signal.direction !== "neutral") {
      posDirection = signal.direction;
      entryPrice = candle.close;
      entryTime = candle.time;

      // Position sizing: fraction of equity, scaled by signal strength
      const leverage = clamp(Math.abs(signal.strength) * maxLeverage, 1, maxLeverage);
      positionSize = equity * positionSizeFraction * leverage;
      positionQty = positionSize / entryPrice;
      inPosition = true;
    }

    // Track equity curve
    const currentEquity = inPosition
      ? equity +
        (posDirection === "long"
          ? (candle.close - entryPrice) * positionQty
          : (entryPrice - candle.close) * positionQty)
      : equity;

    peakEquity = Math.max(peakEquity, currentEquity);
    const drawdown = peakEquity - currentEquity;
    const drawdownPercent = peakEquity > 0 ? drawdown / peakEquity : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    maxDrawdownPercent = Math.max(maxDrawdownPercent, drawdownPercent);

    equityCurve.push({
      time: candle.time,
      equity: Math.round(currentEquity * 100) / 100,
      drawdown: Math.round(drawdownPercent * 10000) / 10000,
      position: inPosition ? (posDirection as "long" | "short") : "flat",
    });

    // Period return for Sharpe
    if (i > 0) {
      const periodReturn = (currentEquity - prevEquity) / prevEquity;
      periodReturns.push(periodReturn);
    }
  }

  // Calculate metrics
  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl <= 0);

  const totalReturn = equity - config.initialCapital;
  const totalReturnPercent = totalReturn / config.initialCapital;

  const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;

  const grossProfit = winningTrades.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((a, t) => a + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((a, t) => a + t.pnl, 0) / winningTrades.length
    : 0;
  const avgLoss = losingTrades.length > 0
    ? losingTrades.reduce((a, t) => a + t.pnl, 0) / losingTrades.length
    : 0;

  // Sharpe ratio (annualized)
  const tfMs = TF_TO_MS[config.timeframe] ?? 3_600_000;
  const periodsPerYear = (365 * 24 * 3_600_000) / tfMs;
  const meanReturn = periodReturns.length > 0
    ? periodReturns.reduce((a, b) => a + b, 0) / periodReturns.length
    : 0;
  const stdReturn = periodReturns.length > 1
    ? Math.sqrt(
        periodReturns.reduce((acc, r) => acc + (r - meanReturn) ** 2, 0) /
          (periodReturns.length - 1),
      )
    : 0;
  const sharpeRatio = stdReturn > 0
    ? (meanReturn / stdReturn) * Math.sqrt(periodsPerYear)
    : 0;

  // Annualized return
  const totalPeriods = candles.length;
  const yearsElapsed = totalPeriods / periodsPerYear;
  const annualizedReturn = yearsElapsed > 0
    ? Math.pow(1 + totalReturnPercent, 1 / yearsElapsed) - 1
    : 0;

  // Average holding period (in candles)
  const avgHoldingPeriod = trades.length > 0
    ? trades.reduce((a, t) => a + (t.exitTime - t.entryTime), 0) / trades.length / tfMs
    : 0;

  const metrics: BacktestMetrics = {
    totalReturn: Math.round(totalReturn * 100) / 100,
    totalReturnPercent: Math.round(totalReturnPercent * 10000) / 10000,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    maxDrawdownPercent: Math.round(maxDrawdownPercent * 10000) / 10000,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    winRate: Math.round(winRate * 10000) / 10000,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    profitFactor: profitFactor === Infinity ? 999.99 : Math.round(profitFactor * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    avgHoldingPeriod: Math.round(avgHoldingPeriod * 100) / 100,
    annualizedReturn: Math.round(annualizedReturn * 10000) / 10000,
  };

  return {
    config,
    metrics,
    equityCurve,
    trades,
    startTime: candles[0].time,
    endTime: candles[candles.length - 1].time,
    executionTimeMs: Date.now() - startMs,
  };
}
