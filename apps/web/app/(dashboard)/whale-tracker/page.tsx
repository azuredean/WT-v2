"use client";

export default function WhaleTrackerPage() {
  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      {/* Participant Profiles */}
      <div className="col-span-1 rounded-lg border border-border bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-4">📊 参与者画像分布</h2>
        <div className="space-y-3">
          {[
            { type: "🧠 聊明鲸", count: 587, pnl: "+$82.3M", color: "text-green" },
            { type: "🤡 愚蠢鲸", count: 817, pnl: "-$37.1M", color: "text-red" },
            { type: "🏦 做市商", count: 124, pnl: "+$5.2M", color: "text-blue" },
            { type: "👥 散户群体", count: "~45K", pnl: "-$18.7M", color: "text-amber" },
            { type: "🔄 套利者", count: 89, pnl: "+$2.1M", color: "text-purple" },
          ].map((p) => (
            <div key={p.type} className="flex items-center justify-between rounded-md bg-bg-tertiary p-3">
              <div>
                <span className="text-sm">{p.type}</span>
                <span className="ml-2 text-xs text-text-muted">({p.count})</span>
              </div>
              <span className={`font-mono text-sm font-semibold ${p.color}`}>{p.pnl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Whale Activity */}
      <div className="col-span-2 rounded-lg border border-border bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-4">🐳 巨鲸活动监控</h2>
        <p className="text-sm text-text-muted">实时监控巨鲸仓位变化、清算事件和大额交易...</p>
        <div className="mt-4 text-center text-text-muted text-sm py-20 border border-dashed border-border rounded-lg">
          Phase 2 实现：实时巨鲸活动 Feed + 清算热力图
        </div>
      </div>
    </div>
  );
}
