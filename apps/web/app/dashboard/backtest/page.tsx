"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

const BASE_URL = process.env.NEXT_PUBLIC_BFF_URL || "http://localhost:3001";

interface BacktestTrade {
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

interface EquityCurvePoint {
  time: number;
  equity: number;
  drawdown: number;
  position: "long" | "short" | "flat";
}

interface BacktestMetrics {
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

interface BacktestResult {
  config: Record<string, unknown>;
  metrics: BacktestMetrics;
  equityCurve: EquityCurvePoint[];
  trades: BacktestTrade[];
  startTime: number;
  endTime: number;
  executionTimeMs: number;
  parameterScan?: {
    best: {
      entryThreshold: number;
      positionSizeFraction: number;
      totalReturnPercent: number;
      sharpeRatio: number;
    };
    top: Array<{
      entryThreshold: number;
      positionSizeFraction: number;
      totalReturnPercent: number;
      sharpeRatio: number;
    }>;
  };
}

interface BacktestConfig {
  symbol: string;
  timeframe: string;
  candleCount: number;
  initialCapital: number;
  entryThreshold: number;
  positionSizeFraction: number;
  maxLeverage: number;
  stopLoss: number;
  takeProfit: number;
  scan?: boolean;
  entryThresholdRange?: [number, number, number];
  positionSizeRange?: [number, number, number];
}

async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  const res = await fetch(`${BASE_URL}/api/trading/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Backtest failed: ${res.status}`);
  }
  return res.json();
}

function EquityCurveChart({ data }: { data: EquityCurvePoint[] }) {
  if (data.length < 2) return null;

  const width = 600;
  const height = 200;
  const padding = { top: 10, right: 10, bottom: 10, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const equities = data.map((d) => d.equity);
  const minEq = Math.min(...equities);
  const maxEq = Math.max(...equities);
  const range = maxEq - minEq || 1;

  const points = data
    .map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = padding.top + chartH - ((d.equity - minEq) / range) * chartH;
      return `${x},${y}`;
    })
    .join(" ");

  // Determine line color based on final return
  const finalReturn = data[data.length - 1].equity - data[0].equity;
  const lineColor = finalReturn >= 0 ? "#22c55e" : "#ef4444";

  // Build fill area
  const firstX = padding.left;
  const lastX = padding.left + chartW;
  const bottomY = padding.top + chartH;
  const fillPoints = `${firstX},${bottomY} ${points} ${lastX},${bottomY}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((frac) => {
        const y = padding.top + chartH * (1 - frac);
        return (
          <line
            key={frac}
            x1={padding.left}
            y1={y}
            x2={padding.left + chartW}
            y2={y}
            stroke="currentColor"
            className="text-border"
            strokeDasharray="4 4"
            strokeWidth={0.5}
          />
        );
      })}
      {/* Fill area */}
      <polygon points={fillPoints} fill={lineColor} fillOpacity={0.1} />
      {/* Main line */}
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* Start / end labels */}
      <text
        x={padding.left + 2}
        y={padding.top + 10}
        fill="currentColor"
        className="text-text-muted"
        fontSize={10}
      >
        ${minEq.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </text>
      <text
        x={padding.left + chartW - 2}
        y={padding.top + 10}
        fill="currentColor"
        className="text-text-muted"
        fontSize={10}
        textAnchor="end"
      >
        ${maxEq.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </text>
    </svg>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-md bg-bg-tertiary p-3">
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className={`text-sm font-mono font-semibold ${color || "text-text-primary"}`}>
        {value}
      </div>
    </div>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BacktestPage() {
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [timeframe, setTimeframe] = useState("1h");
  const [candleCount, setCandleCount] = useState(500);
  const [initialCapital, setInitialCapital] = useState(10000);
  const [entryThreshold, setEntryThreshold] = useState(0.3);
  const [positionSizeFraction, setPositionSizeFraction] = useState(0.5);
  const [maxLeverage, setMaxLeverage] = useState(3);
  const [stopLoss, setStopLoss] = useState(0.03);
  const [takeProfit, setTakeProfit] = useState(0.06);
  const [scan, setScan] = useState(false);

  const mutation = useMutation<BacktestResult, Error, BacktestConfig>({
    mutationFn: runBacktest,
  });

  const handleRun = () => {
    mutation.mutate({
      symbol,
      timeframe,
      candleCount,
      initialCapital,
      entryThreshold,
      positionSizeFraction,
      maxLeverage,
      stopLoss,
      takeProfit,
      scan,
      entryThresholdRange: [0.2, 0.6, 0.1],
      positionSizeRange: [0.3, 0.9, 0.2],
    });
  };

  const result = mutation.data;
  const metrics = result?.metrics;

  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      {/* Config panel */}
      <div className="rounded-lg border border-border bg-bg-card p-4 overflow-auto">
        <h2 className="text-sm font-semibold text-text-primary mb-4">
          回测配置
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-text-muted block mb-1">交易对</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none"
            >
              <option value="BTC/USDT">BTC/USDT</option>
              <option value="ETH/USDT">ETH/USDT</option>
              <option value="SOL/USDT">SOL/USDT</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">时间框架</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none"
            >
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1d">1d</option>
              <option value="15m">15m</option>
              <option value="5m">5m</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">
              K线数量
            </label>
            <input
              type="number"
              value={candleCount}
              onChange={(e) => setCandleCount(Number(e.target.value))}
              min={50}
              max={1500}
              className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm font-mono text-text-primary outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">
              初始资金 (USDT)
            </label>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm font-mono text-text-primary outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-muted block mb-1">
                入场阈值
              </label>
              <input
                type="number"
                value={entryThreshold}
                onChange={(e) => setEntryThreshold(Number(e.target.value))}
                step={0.05}
                min={0}
                max={1}
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm font-mono text-text-primary outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">
                仓位比例
              </label>
              <input
                type="number"
                value={positionSizeFraction}
                onChange={(e) =>
                  setPositionSizeFraction(Number(e.target.value))
                }
                step={0.1}
                min={0.1}
                max={1}
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm font-mono text-text-primary outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-text-muted block mb-1">
                杠杆
              </label>
              <input
                type="number"
                value={maxLeverage}
                onChange={(e) => setMaxLeverage(Number(e.target.value))}
                min={1}
                max={20}
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm font-mono text-text-primary outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">
                止损%
              </label>
              <input
                type="number"
                value={(stopLoss * 100).toFixed(1)}
                onChange={(e) => setStopLoss(Number(e.target.value) / 100)}
                step={0.5}
                min={0.5}
                max={20}
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm font-mono text-text-primary outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">
                止盈%
              </label>
              <input
                type="number"
                value={(takeProfit * 100).toFixed(1)}
                onChange={(e) => setTakeProfit(Number(e.target.value) / 100)}
                step={0.5}
                min={1}
                max={50}
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm font-mono text-text-primary outline-none"
              />
            </div>
          </div>
          <button
            onClick={handleRun}
            disabled={mutation.isPending}
            className="w-full rounded-md bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "回测中..." : "开始回测"}
          </button>
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={scan}
              onChange={(e) => setScan(e.target.checked)}
            />
            同时执行参数搜索（entryThreshold × positionSize）
          </label>
          {mutation.isError && (
            <div className="rounded-md bg-red/10 border border-red/20 p-2 text-xs text-red">
              {mutation.error.message}
            </div>
          )}
        </div>
      </div>

      {/* Results panel */}
      <div className="col-span-2 rounded-lg border border-border bg-bg-card p-4 overflow-auto">
        <h2 className="text-sm font-semibold text-text-primary mb-4">
          回测结果
        </h2>

        {mutation.isPending && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue border-t-transparent" />
            <p className="mt-3 text-sm text-text-muted">
              正在回测，可能需要数秒...
            </p>
          </div>
        )}

        {!result && !mutation.isPending && (
          <div className="text-center text-text-muted text-sm py-32 border border-dashed border-border rounded-lg">
            配置参数后点击"开始回测"
          </div>
        )}

        {result && metrics && (
          <div className="space-y-4">
            {/* Execution info */}
            <div className="text-xs text-text-muted">
              耗时 {result.executionTimeMs}ms | {result.trades.length} 笔交易 |{" "}
              {formatDate(result.startTime)} - {formatDate(result.endTime)}
            </div>

            {/* Equity Curve */}
            <div className="rounded-lg border border-border bg-bg-tertiary p-3">
              <div className="text-xs text-text-muted mb-2">权益曲线</div>
              <EquityCurveChart data={result.equityCurve} />
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-2">
              <MetricCard
                label="总收益率"
                value={`${metrics.totalReturnPercent >= 0 ? "+" : ""}${metrics.totalReturnPercent.toFixed(2)}%`}
                color={
                  metrics.totalReturnPercent >= 0 ? "text-green" : "text-red"
                }
              />
              <MetricCard
                label="最大回撤"
                value={`-${metrics.maxDrawdownPercent.toFixed(2)}%`}
                color="text-red"
              />
              <MetricCard
                label="Sharpe Ratio"
                value={metrics.sharpeRatio.toFixed(2)}
                color={
                  metrics.sharpeRatio > 1
                    ? "text-green"
                    : metrics.sharpeRatio > 0
                    ? "text-amber"
                    : "text-red"
                }
              />
              <MetricCard
                label="胜率"
                value={`${(metrics.winRate * 100).toFixed(1)}%`}
                color={
                  metrics.winRate > 0.5
                    ? "text-green"
                    : metrics.winRate > 0.4
                    ? "text-amber"
                    : "text-red"
                }
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              <MetricCard
                label="总收益"
                value={`$${metrics.totalReturn.toFixed(2)}`}
                color={
                  metrics.totalReturn >= 0 ? "text-green" : "text-red"
                }
              />
              <MetricCard
                label="盈亏比"
                value={metrics.profitFactor.toFixed(2)}
              />
              <MetricCard
                label="平均盈利"
                value={`$${metrics.avgWin.toFixed(2)}`}
                color="text-green"
              />
              <MetricCard
                label="平均亏损"
                value={`$${metrics.avgLoss.toFixed(2)}`}
                color="text-red"
              />
            </div>

            {/* Trade Log */}
            {result.trades.length > 0 && (
              <div>
                <div className="text-xs text-text-muted mb-2">
                  交易记录 ({metrics.winningTrades}W / {metrics.losingTrades}L)
                </div>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-bg-tertiary text-text-muted">
                        <th className="px-2 py-1.5 text-left">#</th>
                        <th className="px-2 py-1.5 text-left">方向</th>
                        <th className="px-2 py-1.5 text-right">入场价</th>
                        <th className="px-2 py-1.5 text-right">出场价</th>
                        <th className="px-2 py-1.5 text-right">PnL</th>
                        <th className="px-2 py-1.5 text-right">PnL%</th>
                        <th className="px-2 py-1.5 text-left">原因</th>
                        <th className="px-2 py-1.5 text-left">时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((t, i) => (
                        <tr
                          key={i}
                          className="border-t border-border hover:bg-bg-hover transition-colors"
                        >
                          <td className="px-2 py-1.5 font-mono text-text-muted">
                            {i + 1}
                          </td>
                          <td className="px-2 py-1.5">
                            <span
                              className={`font-semibold ${
                                t.direction === "long"
                                  ? "text-green"
                                  : "text-red"
                              }`}
                            >
                              {t.direction === "long" ? "LONG" : "SHORT"}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-text-secondary">
                            ${t.entryPrice.toLocaleString()}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-text-secondary">
                            ${t.exitPrice.toLocaleString()}
                          </td>
                          <td
                            className={`px-2 py-1.5 text-right font-mono font-semibold ${
                              t.pnl >= 0 ? "text-green" : "text-red"
                            }`}
                          >
                            {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                          </td>
                          <td
                            className={`px-2 py-1.5 text-right font-mono ${
                              t.pnlPercent >= 0 ? "text-green" : "text-red"
                            }`}
                          >
                            {t.pnlPercent >= 0 ? "+" : ""}
                            {t.pnlPercent.toFixed(2)}%
                          </td>
                          <td className="px-2 py-1.5 text-text-muted capitalize">
                            {t.exitReason.replace(/_/g, " ")}
                          </td>
                          <td className="px-2 py-1.5 text-text-muted">
                            {formatDate(t.entryTime)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.parameterScan && (
              <div>
                <div className="text-xs text-text-muted mb-2">参数搜索结果（Top 5）</div>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-bg-tertiary text-text-muted">
                        <th className="px-2 py-1.5 text-left">#</th>
                        <th className="px-2 py-1.5 text-right">Entry Threshold</th>
                        <th className="px-2 py-1.5 text-right">Position Size</th>
                        <th className="px-2 py-1.5 text-right">Return%</th>
                        <th className="px-2 py-1.5 text-right">Sharpe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.parameterScan.top.map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-2 py-1.5">{i + 1}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{row.entryThreshold.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{row.positionSizeFraction.toFixed(2)}</td>
                          <td className={`px-2 py-1.5 text-right font-mono ${row.totalReturnPercent >= 0 ? "text-green" : "text-red"}`}>
                            {row.totalReturnPercent >= 0 ? "+" : ""}
                            {(row.totalReturnPercent * 100).toFixed(2)}%
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono">{row.sharpeRatio.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
