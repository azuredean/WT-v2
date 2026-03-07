"use client";

import { useTradeStore, type Position } from "@/stores/useTradeStore";

function PositionRow({ position }: { position: Position }) {
  const isLong = position.side === "long";
  const pnlColor = position.unrealizedPnl >= 0 ? "text-green" : "text-red";

  return (
    <tr className="border-b border-border/50 hover:bg-bg-hover transition-colors">
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{position.symbol}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
              isLong ? "bg-green/20 text-green" : "bg-red/20 text-red"
            }`}
          >
            {isLong ? "LONG" : "SHORT"}
          </span>
          <span className="text-xs text-text-muted">{position.leverage}x</span>
        </div>
      </td>
      <td className="py-2.5 px-3 font-mono text-sm text-text-secondary">
        ${position.entryPrice.toLocaleString()}
      </td>
      <td className="py-2.5 px-3 font-mono text-sm text-text-primary">
        ${position.currentPrice.toLocaleString()}
      </td>
      <td className="py-2.5 px-3 font-mono text-sm text-text-secondary">
        {position.quantity.toFixed(4)}
      </td>
      <td className={`py-2.5 px-3 font-mono text-sm font-semibold ${pnlColor}`}>
        {position.unrealizedPnl >= 0 ? "+" : ""}
        ${position.unrealizedPnl.toFixed(2)}
      </td>
      <td className={`py-2.5 px-3 font-mono text-sm ${pnlColor}`}>
        {position.unrealizedPnlPct >= 0 ? "+" : ""}
        {position.unrealizedPnlPct.toFixed(2)}%
      </td>
      <td className="py-2.5 px-3 font-mono text-xs text-text-muted capitalize">
        {position.exchange}
      </td>
    </tr>
  );
}

export function PositionSummary() {
  const { positions, totalPnl } = useTradeStore();

  // Demo positions
  const demoPositions: Position[] =
    positions.length > 0
      ? positions
      : [
          {
            id: "1", exchange: "binance", symbol: "BTC/USDT", side: "long",
            entryPrice: 69850, currentPrice: 72192, quantity: 0.15, leverage: 5,
            unrealizedPnl: 351.3, unrealizedPnlPct: 3.35, marginUsed: 2095.5,
            liquidationPrice: 59200, openedAt: Date.now() - 86400000 * 3,
          },
          {
            id: "2", exchange: "okx", symbol: "ETH/USDT", side: "long",
            entryPrice: 3820, currentPrice: 3905, quantity: 2.0, leverage: 3,
            unrealizedPnl: 170.0, unrealizedPnlPct: 2.23, marginUsed: 2546.7,
            liquidationPrice: 2900, openedAt: Date.now() - 86400000,
          },
          {
            id: "3", exchange: "bybit", symbol: "SOL/USDT", side: "short",
            entryPrice: 185.5, currentPrice: 182.3, quantity: 50, leverage: 10,
            unrealizedPnl: 160.0, unrealizedPnlPct: 1.72, marginUsed: 927.5,
            liquidationPrice: 203.5, openedAt: Date.now() - 3600000 * 8,
          },
        ];

  const demoPnl = totalPnl || demoPositions.reduce((s, p) => s + p.unrealizedPnl, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-primary">💼 Positions</h3>
        <div className="flex items-center gap-4">
          <span className="text-xs text-text-muted">
            总未实现盈亏:
          </span>
          <span
            className={`font-mono text-sm font-bold ${
              demoPnl >= 0 ? "text-green" : "text-red"
            }`}
          >
            {demoPnl >= 0 ? "+" : ""}${demoPnl.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-xs text-text-muted">
              <th className="py-2 px-3 font-medium">Symbol</th>
              <th className="py-2 px-3 font-medium">Entry</th>
              <th className="py-2 px-3 font-medium">Current</th>
              <th className="py-2 px-3 font-medium">Size</th>
              <th className="py-2 px-3 font-medium">PnL</th>
              <th className="py-2 px-3 font-medium">PnL%</th>
              <th className="py-2 px-3 font-medium">Exchange</th>
            </tr>
          </thead>
          <tbody>
            {demoPositions.map((p) => (
              <PositionRow key={p.id} position={p} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
