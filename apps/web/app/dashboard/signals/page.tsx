"use client";

import { useSignals, type StrategyResult } from "@/hooks/useSignals";

const strategyShortIds: Record<string, string> = {
  s1_whale_tracking: "S1",
  s2_capital_concentration: "S2",
  s3_funding_reversal: "S3",
  s4_liquidity_grab: "S4",
  s5_oi_divergence: "S5",
  s6_retail_counter: "S6",
  s7_stop_hunt: "S7",
  s8_smart_money_edge: "S8",
};

export default function SignalsPage() {
  const { data, isLoading, error } = useSignals();

  const hasRealData = !!data && !error && data.strategies.length > 0;

  const strategies = hasRealData ? data.strategies : [];

  const fused = hasRealData
    ? {
        direction: data.direction,
        strength: data.strength,
        confidence: data.confidence,
        recommendedSize: data.recommendedSize,
        dqs: data.dataQualityScore,
      }
    : {
        direction: "neutral" as const,
        strength: 0,
        confidence: 0,
        recommendedSize: 0,
        dqs: 0,
      };

  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {/* Left: Strategy signals */}
      <div className="rounded-lg border border-border bg-bg-card p-4 overflow-auto">
        <h2 className="text-sm font-semibold text-text-primary mb-4">
          8策略信号融合
          {isLoading && (
            <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-blue" />
          )}
          {!hasRealData && !isLoading && (
            <span className="ml-2 text-xs text-amber font-normal">
              等待数据...
            </span>
          )}
        </h2>

        {strategies.length > 0 ? (
          <>
            <div className="space-y-2">
              {strategies.map((s) => {
                const shortId = strategyShortIds[s.id] || s.id.slice(0, 3).toUpperCase();
                const dirLabel = s.direction === "long" ? "LONG" : s.direction === "short" ? "SHORT" : "\u2014";

                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-md bg-bg-tertiary p-2.5"
                  >
                    <span className="text-xs font-mono text-text-muted w-6">
                      {shortId}
                    </span>
                    <span className="text-sm text-text-secondary w-24">
                      {s.name}
                    </span>
                    <div className="flex-1 h-2 bg-bg-primary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          s.strength > 0 ? "bg-green" : s.strength < 0 ? "bg-red" : "bg-text-muted"
                        }`}
                        style={{ width: `${Math.abs(s.strength) * 100}%` }}
                      />
                    </div>
                    <span
                      className={`font-mono text-xs w-10 text-right ${
                        s.strength > 0
                          ? "text-green"
                          : s.strength < 0
                          ? "text-red"
                          : "text-text-muted"
                      }`}
                    >
                      {s.strength > 0 ? "+" : ""}
                      {s.strength.toFixed(1)}
                    </span>
                    <span
                      className={`text-xs font-semibold w-12 ${
                        s.direction === "long"
                          ? "text-green"
                          : s.direction === "short"
                          ? "text-red"
                          : "text-text-muted"
                      }`}
                    >
                      {dirLabel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Strategy details (confidence & reason) */}
            <div className="mt-4 pt-3 border-t border-border space-y-2">
              <div className="text-xs text-text-muted mb-2">策略详情</div>
              {strategies.map((s) => {
                const shortId = strategyShortIds[s.id] || s.id;
                return (
                  <div
                    key={`detail-${s.id}`}
                    className="text-xs flex items-start gap-2"
                  >
                    <span className="font-mono text-text-muted w-6 shrink-0">
                      {shortId}
                    </span>
                    <span className="text-text-secondary flex-1">
                      {s.reason}
                    </span>
                    <span className="text-text-muted font-mono shrink-0">
                      conf: {s.confidence.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : !isLoading ? (
          <div className="flex items-center justify-center h-48 text-sm text-text-muted">
            交易所 API 不可用，部署至海外服务器后可获取完整信号数据
          </div>
        ) : null}
      </div>

      {/* Right: Fused result + Config */}
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-bg-card p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            融合结果
          </h2>
          <div
            className={`rounded-lg p-4 text-center ${
              fused.direction === "long"
                ? "bg-green/10 border border-green/20"
                : fused.direction === "short"
                ? "bg-red/10 border border-red/20"
                : "bg-bg-tertiary border border-border"
            }`}
          >
            <div
              className={`text-3xl font-mono font-bold ${
                fused.direction === "long"
                  ? "text-green"
                  : fused.direction === "short"
                  ? "text-red"
                  : "text-text-muted"
              }`}
            >
              {fused.strength > 0 ? "+" : ""}
              {fused.strength.toFixed(2)}
            </div>
            <div
              className={`text-sm mt-1 ${
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
            </div>
            <div className="text-xs text-text-muted mt-2">
              建议仓位: {fused.recommendedSize}% (Half-Kelly x 体制系数)
            </div>
          </div>

          {/* Additional details */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-bg-tertiary p-2">
              <div className="text-xs text-text-muted">Confidence</div>
              <div className="text-sm font-mono font-semibold text-text-primary">
                {(fused.confidence * 100).toFixed(0)}%
              </div>
            </div>
            <div className="rounded-md bg-bg-tertiary p-2">
              <div className="text-xs text-text-muted">DQS</div>
              <div
                className={`text-sm font-mono font-semibold ${
                  fused.dqs > 0.85
                    ? "text-green"
                    : fused.dqs > 0.7
                    ? "text-amber"
                    : "text-red"
                }`}
              >
                {(fused.dqs * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-card p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-3">
            策略配置
          </h2>
          <div className="space-y-2 text-xs text-text-muted">
            <p>自动每30秒刷新信号数据。</p>
            {hasRealData && data.timestamp && (
              <p>
                最后更新:{" "}
                {new Date(data.timestamp).toLocaleTimeString("zh-CN")}
              </p>
            )}
            <p className="text-text-muted/60">
              策略权重调节、启用/禁用功能将在后续版本中实现。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
