"use client";

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-lg font-semibold text-text-primary">⚙️ 设置</h1>

      {/* Exchange API Keys */}
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-4">交易所 API 配置</h2>
        {["Binance", "OKX", "Bybit"].map((exchange) => (
          <div key={exchange} className="mb-4 last:mb-0 rounded-md bg-bg-tertiary p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{exchange}</span>
              <span className="text-xs text-text-muted rounded px-2 py-0.5 bg-bg-hover">
                未连接
              </span>
            </div>
            <div className="space-y-2">
              <input placeholder="API Key" className="w-full rounded border border-border bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none" />
              <input placeholder="API Secret" type="password" className="w-full rounded border border-border bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none" />
              {exchange === "OKX" && (
                <input placeholder="Passphrase" type="password" className="w-full rounded border border-border bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none" />
              )}
            </div>
          </div>
        ))}
        <button className="mt-2 rounded-md bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue/80 transition-colors">
          保存配置
        </button>
      </div>

      {/* Strategy Weights */}
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-4">策略权重配置</h2>
        <p className="text-sm text-text-muted">Phase 3 实现：调节 8 个策略的权重</p>
      </div>

      {/* Anomaly Detection */}
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-4">异常检测阈值</h2>
        <p className="text-sm text-text-muted">Phase 4 实现：熔断器参数配置</p>
      </div>
    </div>
  );
}
