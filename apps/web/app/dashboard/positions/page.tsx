"use client";

import { useEffect, useMemo, useState } from "react";
import { PositionSummary } from "@/features/trading/components/PositionSummary";
import { useMarketStore } from "@/stores/useMarketStore";

const BASE_URL = process.env.NEXT_PUBLIC_BFF_URL || "http://localhost:3001";

type OrderSide = "buy" | "sell";
type OrderType = "market" | "limit";

export default function PositionsPage() {
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const [positions, setPositions] = useState<Array<any>>([]);
  const [trades, setTrades] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState({
    symbol: selectedSymbol,
    side: "buy" as OrderSide,
    type: "market" as OrderType,
    quantity: 0.01,
    price: "",
    leverage: 3,
  });

  async function loadPositions() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/trading/positions`);
      const json = await res.json();
      setPositions(Array.isArray(json?.positions) ? json.positions : []);
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const res = await fetch(`${BASE_URL}/api/trading/history?limit=200`);
      const json = await res.json();
      setTrades(Array.isArray(json?.trades) ? json.trades : []);
    } catch {
      setTrades([]);
    }
  }

  useEffect(() => {
    loadPositions();
    loadHistory();
  }, []);

  useEffect(() => {
    setOrder((prev) => ({ ...prev, symbol: selectedSymbol }));
  }, [selectedSymbol]);

  async function placeOrder() {
    setPlacing(true);
    try {
      await fetch(`${BASE_URL}/api/trading/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          quantity: order.quantity,
          price: order.type === "limit" ? Number(order.price || 0) : undefined,
          leverage: order.leverage,
        }),
      });
      await loadPositions();
      await loadHistory();
    } finally {
      setPlacing(false);
    }
  }

  async function closePosition(positionId: string) {
    await fetch(`${BASE_URL}/api/trading/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionId }),
    });
    await loadPositions();
    await loadHistory();
  }

  async function closeAllPositions() {
    await fetch(`${BASE_URL}/api/trading/close-all`, { method: "POST" });
    await loadPositions();
    await loadHistory();
  }

  const stats = useMemo(() => {
    const count = positions.length;
    const longCount = positions.filter((p) => (p.side || "").toLowerCase() === "buy" || (p.side || "").toLowerCase() === "long").length;
    const shortCount = count - longCount;
    const grossNotional = positions.reduce((s, p) => s + Number(p.quantity || 0) * Number(p.entry_price || p.currentPrice || 0), 0);
    return { count, longCount, shortCount, grossNotional };
  }, [positions]);

  return (
    <div className="h-full space-y-4">
      <div className="rounded-lg border border-border bg-bg-card p-4 h-1/2">
        <PositionSummary />
      </div>

      <div className="grid grid-cols-2 gap-4 h-1/2">
        <div className="rounded-lg border border-border bg-bg-card p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-4">📝 下单面板</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <select
                value={order.symbol}
                onChange={(e) => setOrder((o) => ({ ...o, symbol: e.target.value }))}
                className="rounded border border-border bg-bg-primary px-2 py-1.5 text-sm"
              >
                <option>BTC/USDT</option>
                <option>ETH/USDT</option>
                <option>SOL/USDT</option>
                <option>BNB/USDT</option>
              </select>
              <select
                value={order.type}
                onChange={(e) => setOrder((o) => ({ ...o, type: e.target.value as OrderType }))}
                className="rounded border border-border bg-bg-primary px-2 py-1.5 text-sm"
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select
                value={order.side}
                onChange={(e) => setOrder((o) => ({ ...o, side: e.target.value as OrderSide }))}
                className="rounded border border-border bg-bg-primary px-2 py-1.5 text-sm"
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
              <input
                type="number"
                step="0.0001"
                value={order.quantity}
                onChange={(e) => setOrder((o) => ({ ...o, quantity: Number(e.target.value || 0) }))}
                className="rounded border border-border bg-bg-primary px-2 py-1.5 text-sm"
                placeholder="Quantity"
              />
            </div>

            {order.type === "limit" && (
              <input
                type="number"
                value={order.price}
                onChange={(e) => setOrder((o) => ({ ...o, price: e.target.value }))}
                className="w-full rounded border border-border bg-bg-primary px-2 py-1.5 text-sm"
                placeholder="Limit Price"
              />
            )}

            <div className="grid grid-cols-[1fr_140px] gap-3 items-center">
              <input
                type="range"
                min={1}
                max={20}
                value={order.leverage}
                onChange={(e) => setOrder((o) => ({ ...o, leverage: Number(e.target.value || 1) }))}
              />
              <div className="text-sm text-text-secondary">杠杆: {order.leverage}x</div>
            </div>

            <button
              onClick={placeOrder}
              disabled={placing || order.quantity <= 0}
              className="w-full rounded bg-blue px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {placing ? "提交中..." : "提交订单"}
            </button>

            <button
              onClick={loadPositions}
              disabled={loading}
              className="w-full rounded border border-border px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover"
            >
              {loading ? "刷新中..." : "刷新持仓"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-card p-4 overflow-auto">
          <h2 className="text-sm font-semibold text-text-primary mb-4">📊 盈亏统计</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">当前持仓数</span><span className="font-mono">{stats.count}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">多头数量</span><span className="font-mono text-green">{stats.longCount}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">空头数量</span><span className="font-mono text-red">{stats.shortCount}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">名义总敞口</span><span className="font-mono">${stats.grossNotional.toFixed(2)}</span></div>

            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-text-muted">最近订单执行</div>
                <button
                  onClick={closeAllPositions}
                  className="text-xs rounded border border-border px-2 py-1 hover:bg-bg-hover"
                >
                  一键平仓
                </button>
              </div>
              <div className="max-h-44 overflow-auto rounded border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-bg-tertiary text-text-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">Time</th>
                      <th className="px-2 py-1 text-left">Symbol</th>
                      <th className="px-2 py-1 text-left">Side</th>
                      <th className="px-2 py-1 text-right">Qty</th>
                      <th className="px-2 py-1 text-right">Price</th>
                      <th className="px-2 py-1 text-right">Realized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.slice().reverse().slice(0, 20).map((t, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-2 py-1">{new Date(Number(t.timestamp || 0)).toLocaleTimeString()}</td>
                        <td className="px-2 py-1">{t.symbol || "-"}</td>
                        <td className="px-2 py-1 capitalize">{t.side || "-"}</td>
                        <td className="px-2 py-1 text-right font-mono">{Number(t.quantity || 0).toFixed(4)}</td>
                        <td className="px-2 py-1 text-right font-mono">{Number(t.price || 0).toFixed(2)}</td>
                        <td className={`px-2 py-1 text-right font-mono ${Number(t.realized_pnl || 0) >= 0 ? "text-green" : "text-red"}`}>
                          {Number(t.realized_pnl || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {trades.length === 0 && (
                      <tr>
                        <td className="px-2 py-3 text-center text-text-muted" colSpan={6}>暂无交易记录</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-xs text-text-muted">当前持仓</div>
              <div className="max-h-36 overflow-auto rounded border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-bg-tertiary text-text-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">ID</th>
                      <th className="px-2 py-1 text-left">Symbol</th>
                      <th className="px-2 py-1 text-left">Side</th>
                      <th className="px-2 py-1 text-right">Qty</th>
                      <th className="px-2 py-1 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p, i) => (
                      <tr key={p.id || i} className="border-t border-border">
                        <td className="px-2 py-1 font-mono">{String(p.id || "").slice(0, 8)}</td>
                        <td className="px-2 py-1">{p.symbol}</td>
                        <td className="px-2 py-1 capitalize">{p.side}</td>
                        <td className="px-2 py-1 text-right font-mono">{Number(p.quantity || 0).toFixed(4)}</td>
                        <td className="px-2 py-1 text-right">
                          <button onClick={() => closePosition(p.id)} className="rounded border border-border px-2 py-0.5 hover:bg-bg-hover">平仓</button>
                        </td>
                      </tr>
                    ))}
                    {positions.length === 0 && (
                      <tr>
                        <td className="px-2 py-3 text-center text-text-muted" colSpan={5}>暂无持仓</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
