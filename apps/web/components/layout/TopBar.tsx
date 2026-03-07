"use client";

import { useMarketStore } from "@/stores/useMarketStore";

const exchanges = ["binance", "okx", "bybit"] as const;
const timeframes = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

export function TopBar() {
  const {
    selectedSymbol,
    selectedExchange,
    selectedTimeframe,
    lastPrice,
    setSymbol,
    setExchange,
    setTimeframe,
  } = useMarketStore();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-bg-secondary px-4">
      {/* Left: Symbol + Price */}
      <div className="flex items-center gap-4">
        <select
          value={selectedSymbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="rounded-md border border-border bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-blue"
        >
          <option value="BTC/USDT">BTC/USDT</option>
          <option value="ETH/USDT">ETH/USDT</option>
          <option value="SOL/USDT">SOL/USDT</option>
          <option value="BNB/USDT">BNB/USDT</option>
        </select>

        <span className="font-mono text-lg font-semibold text-text-primary">
          {lastPrice > 0 ? `$${lastPrice.toLocaleString()}` : "—"}
        </span>
      </div>

      {/* Center: Timeframe */}
      <div className="flex items-center gap-1">
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedTimeframe === tf
                ? "bg-blue text-white"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Right: Exchange */}
      <div className="flex items-center gap-2">
        {exchanges.map((ex) => (
          <button
            key={ex}
            onClick={() => setExchange(ex)}
            className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
              selectedExchange === ex
                ? "bg-purple text-white"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
          >
            {ex}
          </button>
        ))}
      </div>
    </header>
  );
}
