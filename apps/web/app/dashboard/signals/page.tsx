"use client";

export default function SignalsPage() {
  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-4">⚡ 8策略信号融合</h2>
        <div className="space-y-2">
          {[
            { id: "S1", name: "巨鲸跟单", score: 0.8, dir: "LONG" },
            { id: "S2", name: "资金集中", score: 0.7, dir: "LONG" },
            { id: "S3", name: "资金费反转", score: 0.3, dir: "LONG" },
            { id: "S4", name: "流动性抓取", score: -0.2, dir: "SHORT" },
            { id: "S5", name: "OI背离", score: 0.4, dir: "LONG" },
            { id: "S6", name: "散户反向", score: 0.6, dir: "LONG" },
            { id: "S7", name: "止损猎杀", score: 0.5, dir: "LONG" },
            { id: "S8", name: "聊明钱优势", score: 0.8, dir: "LONG" },
          ].map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-md bg-bg-tertiary p-2.5">
              <span className="text-xs font-mono text-text-muted w-6">{s.id}</span>
              <span className="text-sm text-text-secondary w-24">{s.name}</span>
              <div className="flex-1 h-2 bg-bg-primary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${s.score > 0 ? "bg-green" : "bg-red"}`}
                  style={{ width: `${Math.abs(s.score) * 100}%` }}
                />
              </div>
              <span className={`font-mono text-xs w-10 text-right ${s.score > 0 ? "text-green" : "text-red"}`}>
                {s.score > 0 ? "+" : ""}{s.score.toFixed(1)}
              </span>
              <span className={`text-xs font-semibold w-12 ${s.dir === "LONG" ? "text-green" : "text-red"}`}>
                {s.dir}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-bg-card p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-3">🎯 融合结果</h2>
          <div className="rounded-lg bg-green/10 border border-green/20 p-4 text-center">
            <div className="text-3xl font-mono font-bold text-green">+0.72</div>
            <div className="text-sm text-green mt-1">⬆ 强烈做多</div>
            <div className="text-xs text-text-muted mt-2">建议仓位: 3.2% (Half-Kelly × 体制系数)</div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-card p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-3">📋 策略配置</h2>
          <p className="text-sm text-text-muted">Phase 3 实现：策略权重调节、启用/禁用、参数配置</p>
        </div>
      </div>
    </div>
  );
}
