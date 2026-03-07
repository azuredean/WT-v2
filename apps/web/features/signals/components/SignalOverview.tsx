"use client";

import { useSignalStore, type StrategySignal } from "@/stores/useSignalStore";

const strategyLabels: Record<string, string> = {
  s1_whale_tracking: "S1 巨鲸跟单",
  s2_capital_concentration: "S2 资金集中",
  s3_funding_reversal: "S3 资金费反转",
  s4_liquidity_grab: "S4 流动性抓取",
  s5_oi_divergence: "S5 OI背离",
  s6_retail_counter: "S6 散户反向",
  s7_stop_hunt: "S7 止损猎杀",
  s8_smart_money_edge: "S8 聊明钱优势",
};

function SignalBar({ signal }: { signal: StrategySignal }) {
  const isLong = signal.direction === "long";
  const isShort = signal.direction === "short";
  const barColor = isLong ? "bg-green" : isShort ? "bg-red" : "bg-text-muted";
  const dirLabel = isLong ? "LONG" : isShort ? "SHORT" : "—";

  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-28 text-xs text-text-secondary truncate">
        {strategyLabels[signal.strategyId] || signal.name}
      </span>
      <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${Math.abs(signal.strength) * 100}%` }}
        />
      </div>
      <span
        className={`w-10 text-right font-mono text-xs ${
          isLong ? "text-green" : isShort ? "text-red" : "text-text-muted"
        }`}
      >
        {(signal.strength > 0 ? "+" : "") + signal.strength.toFixed(1)}
      </span>
      <span
        className={`w-12 text-right text-xs font-medium ${
          isLong ? "text-green" : isShort ? "text-red" : "text-text-muted"
        }`}
      >
        {dirLabel}
      </span>
    </div>
  );
}

export function SignalOverview() {
  const { strategies, fusedSignal, dataQualityScore } = useSignalStore();

  // Demo data when no real signals
  const demoStrategies: StrategySignal[] =
    strategies.length > 0
      ? strategies
      : [
          { strategyId: "s1_whale_tracking", name: "Whale Tracking", direction: "long", strength: 0.8, confidence: 0.85, updatedAt: Date.now() },
          { strategyId: "s2_capital_concentration", name: "Capital Conc", direction: "long", strength: 0.7, confidence: 0.75, updatedAt: Date.now() },
          { strategyId: "s3_funding_reversal", name: "Funding Rev", direction: "long", strength: 0.3, confidence: 0.6, updatedAt: Date.now() },
          { strategyId: "s6_retail_counter", name: "Retail Counter", direction: "long", strength: 0.6, confidence: 0.7, updatedAt: Date.now() },
          { strategyId: "s7_stop_hunt", name: "Stop Hunt", direction: "long", strength: 0.5, confidence: 0.65, updatedAt: Date.now() },
          { strategyId: "s8_smart_money_edge", name: "SME", direction: "long", strength: 0.8, confidence: 0.9, updatedAt: Date.now() },
        ];

  const dqs = dataQualityScore || 0.94;
  const fused = fusedSignal || {
    direction: "long" as const,
    strength: 0.72,
    recommendedSize: 3.2,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-primary">⚡ Signal Fusion</h3>
        <span
          className={`rounded px-2 py-0.5 text-xs font-mono ${
            dqs > 0.85
              ? "bg-green/20 text-green"
              : dqs > 0.7
              ? "bg-amber/20 text-amber"
              : "bg-red/20 text-red"
          }`}
        >
          DQS {(dqs * 100).toFixed(0)}%
        </span>
      </div>

      {/* Fused signal summary */}
      <div
        className={`mb-3 rounded-lg p-3 ${
          fused.direction === "long"
            ? "bg-green/10 border border-green/20"
            : fused.direction === "short"
            ? "bg-red/10 border border-red/20"
            : "bg-bg-tertiary border border-border"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">综合评分</span>
          <span
            className={`text-lg font-mono font-bold ${
              fused.direction === "long" ? "text-green" : "text-red"
            }`}
          >
            {fused.strength > 0 ? "+" : ""}
            {fused.strength.toFixed(2)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span
            className={`text-xs font-semibold ${
              fused.direction === "long" ? "text-green" : "text-red"
            }`}
          >
            {fused.direction === "long" ? "⬆ 强烈做多" : "⬇ 强烈做空"}
          </span>
          <span className="text-xs text-text-muted">
            建议仓位: {fused.recommendedSize}%
          </span>
        </div>
      </div>

      {/* Strategy breakdown */}
      <div className="flex-1 overflow-auto">
        {demoStrategies.map((s) => (
          <SignalBar key={s.strategyId} signal={s} />
        ))}
      </div>
    </div>
  );
}
