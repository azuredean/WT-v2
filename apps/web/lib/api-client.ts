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

// Market data
export const api = {
  market: {
    candles: (symbol: string, timeframe: string, limit = 500) =>
      request<{ data: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> }>(
        `/api/market/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=${limit}`
      ),
    ticker: (symbol: string) =>
      request<{ price: number; change24h: number; volume24h: number }>(
        `/api/market/ticker?symbol=${encodeURIComponent(symbol)}`
      ),
  },

  whale: {
    profiles: (symbol: string) =>
      request<{ profiles: Array<{ type: string; count: number; totalPnl: number; avgLeverage: number; longRatio: number }> }>(
        `/api/whale/profiles?symbol=${encodeURIComponent(symbol)}`
      ),
    activity: (symbol: string, limit = 50) =>
      request<{ activities: Array<unknown> }>(
        `/api/whale/activity?symbol=${encodeURIComponent(symbol)}&limit=${limit}`
      ),
    smartMoneyEdge: (symbol: string) =>
      request<{ sme: number; smartPnl: number; dumbPnl: number; retailPnl: number }>(
        `/api/whale/sme?symbol=${encodeURIComponent(symbol)}`
      ),
  },

  signals: {
    current: (symbol: string) =>
      request<unknown>(`/api/signals/current?symbol=${encodeURIComponent(symbol)}`),
    strategies: () =>
      request<{ strategies: Array<{ id: string; name: string; description: string; enabled: boolean }> }>(
        `/api/signals/strategies`
      ),
  },

  backtest: {
    run: (config: {
      strategyIds: string[];
      symbol: string;
      timeframe: string;
      startDate: string;
      endDate: string;
      initialCapital: number;
    }) =>
      request<{ jobId: string }>(`/api/backtest/run`, {
        method: "POST",
        body: JSON.stringify(config),
      }),
    results: (jobId: string) =>
      request<unknown>(`/api/backtest/${jobId}/results`),
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
