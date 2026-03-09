"use client";

import { useSignals, type StrategyResult } from "@/hooks/useSignals";
import { type StrategySignal } from "@/stores/useSignalStore";

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


function mapStrategyToSignal(s: StrategyResult): StrategySignal {
  return {
    strategyId: s.id,
    name: s.name,
    direction: s.direction,
    strength: s.strength,
    confidence: s.confidence,
    updatedAt: Date.now(),
  };
}

function SignalBar({ signal }: { signal: StrategySignal }) {
  const isLong = signal.direction === "long";
  const isShort = signal.direction === "short";
  const barColor = isLong ? "bg-green" : isShort ? "bg-red" : "bg-text-muted";
  const dirLabel = isLong ? "LONG" : isShort ? "SHORT" : "\u2014";

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
  const { data, isLoading, error } = useSignals();

  const hasRealData = !!data && !error && data.strategies.length > 0;

  const strategies: StrategySignal[] = hasRealData
    ? data.strategies.map(mapStrategyToSignal)
    : [];

  const dqs = hasRealData ? data.dataQualityScore : 0;
  const fused = hasRealData
    ? {
        direction: data.direction,
        strength: data.strength,
        recommendedSize: data.recommendedSize,
      }
    : { direction: "neutral" as const, strength: 0, recommendedSize: 0 };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-primary">
          Signal Fusion
          {isLoading && (
            <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-blue" />
          )}
          {!hasRealData && !isLoading && (
            <span className="ml-2 text-xs text-amber">等待数据...</span>
          )}
        </h3>
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
              fused.direction === "long"
                ? "text-green"
                : fused.direction === "short"
                ? "text-red"
                : "text-text-muted"
            }`}
          >
            {fused.strength > 0 ? "+" : ""}
            {fused.strength.toFixed(2)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span
            className={`text-xs font-semibold ${
              fused.direction === "long"
                ? "text-green"
                : fused.direction === "short"
                ? "text-red"
                : "text-text-muted"
            }`}
          >
            {fused.direction === "long"
              ? "强烈做多"
              : fused.direction === "short"
              ? "强烈做空"
              : "中性"}
          </span>
          <span className="text-xs text-text-muted">
            建议仓位: {fused.recommendedSize}%
          </span>
        </div>
      </div>

      {/* Strategy breakdown */}
      <div className="flex-1 overflow-auto">
        {strategies.length > 0 ? (
          strategies.map((s) => (
            <SignalBar key={s.strategyId} signal={s} />
          ))
        ) : !isLoading ? (
          <div className="flex items-center justify-center h-full text-xs text-text-muted">
            交易所 API 不可用，需部署至海外服务器获取实时数据
          </div>
        ) : null}
      </div>
    </div>
  );
}
