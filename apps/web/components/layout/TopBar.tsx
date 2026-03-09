"use client";

import { useMarketStore } from "@/stores/useMarketStore";
import { useMarketData } from "@/hooks/useMarketData";

const exchanges = ["binance", "okx", "bybit"] as const;
const timeframes = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
}

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

  const { ticker, isLoading } = useMarketData();

  const change24h = ticker?.change24h ?? 0;
  const volume24h = ticker?.volume24h ?? 0;
  const displayPrice = ticker?.price ?? lastPrice;
  const isPositive = change24h >= 0;

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-bg-secondary px-4">
      {/* Left: Symbol + Price + Change + Volume */}
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

        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-semibold text-text-primary">
            {displayPrice > 0 ? `$${displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "\u2014"}
            {isLoading && (
              <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-blue" />
            )}
          </span>

          {ticker && (
            <>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-mono font-semibold ${
                  isPositive
                    ? "bg-green/15 text-green"
                    : "bg-red/15 text-red"
                }`}
              >
                {isPositive ? "+" : ""}
                {change24h.toFixed(2)}%
              </span>

              <span className="text-xs text-text-muted font-mono">
                Vol {formatVolume(volume24h)}
              </span>
            </>
          )}
        </div>
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
