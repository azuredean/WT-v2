const BASE_URL = process.env.NEXT_PUBLIC_BFF_URL || "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface TickerResponse {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StrategyResult {
  id: string;
  name: string;
  direction: "long" | "short" | "neutral";
  strength: number;
  confidence: number;
  reason: string;
}

export interface FusedSignalResponse {
  symbol: string;
  direction: "long" | "short" | "neutral";
  strength: number;
  confidence: number;
  recommendedSize: number;
  dataQualityScore: number;
  strategies: StrategyResult[];
  timestamp: number;
  error?: string;
}

export interface WhaleActivityItem {
  id: string;
  exchange: string;
  symbol: string;
  participantType: string;
  side: "buy" | "sell";
  size: number;
  price: number;
  timestamp: number;
}

export interface ProfileData {
  type: string;
  count: number;
  totalPnl: number;
  avgLeverage: number;
  longRatio: number;
}

export interface SMEResponse {
  sme: number;
  smartPnl: number;
  dumbPnl: number;
  retailPnl: number;
  error?: string;
}

export interface BacktestConfig {
  symbol: string;
  timeframe: string;
  candleCount?: number;
  initialCapital: number;
  entryThreshold?: number;
  positionSizeFraction?: number;
  maxLeverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  enabledStrategies?: string[];
  startDate?: string;
  endDate?: string;
}

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  pnlPercent: number;
  exitReason: string;
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
  annualizedReturn: number;
}

export interface BacktestResult {
  config: Record<string, unknown>;
  metrics: BacktestMetrics;
  equityCurve: EquityCurvePoint[];
  trades: BacktestTrade[];
  startTime: number;
  endTime: number;
  executionTimeMs: number;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const api = {
  market: {
    candles: (symbol: string, timeframe: string, limit = 500) =>
      request<{ data: CandleData[] }>(
        `/api/market/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=${limit}`
      ),
    ticker: (symbol: string) =>
      request<TickerResponse>(
        `/api/market/ticker?symbol=${encodeURIComponent(symbol)}`
      ),
  },

  whale: {
    profiles: (symbol: string) =>
      request<{ profiles: ProfileData[] }>(
        `/api/whale/profiles?symbol=${encodeURIComponent(symbol)}`
      ),
    activity: (symbol: string, limit = 50) =>
      request<{ activities: WhaleActivityItem[] }>(
        `/api/whale/activity?symbol=${encodeURIComponent(symbol)}&limit=${limit}`
      ),
    smartMoneyEdge: (symbol: string) =>
      request<SMEResponse>(
        `/api/whale/sme?symbol=${encodeURIComponent(symbol)}`
      ),
  },

  signals: {
    current: (symbol: string) =>
      request<FusedSignalResponse>(
        `/api/signals/current?symbol=${encodeURIComponent(symbol)}`
      ),
    strategies: () =>
      request<{
        strategies: Array<{
          id: string;
          name: string;
          description: string;
          weight: number;
          enabled: boolean;
        }>;
      }>(`/api/signals/strategies`),
  },

  backtest: {
    run: (config: BacktestConfig) =>
      request<BacktestResult>(`/api/trading/backtest`, {
        method: "POST",
        body: JSON.stringify(config),
      }),
  },

  trading: {
    positions: () =>
      request<{ positions: Array<unknown> }>(`/api/trading/positions`),
    placeOrder: (order: {
      symbol: string;
      side: "buy" | "sell";
      type: "market" | "limit";
      quantity: number;
      price?: number;
      leverage?: number;
    }) =>
      request<{ orderId: string }>(`/api/trading/order`, {
        method: "POST",
        body: JSON.stringify(order),
      }),
  },
};
