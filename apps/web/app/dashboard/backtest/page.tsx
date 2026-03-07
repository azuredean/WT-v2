"use client";

export default function BacktestPage() {
  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-4">📈 回测配置</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-text-muted block mb-1">交易对</label>
            <select className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none">
              <option>BTC/USDT</option>
              <option>ETH/USDT</option>
              <option>SOL/USDT</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">时间框架</label>
            <select className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none">
              <option>1h</option>
              <option>4h</option>
              <option>1d</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-muted block mb-1">开始日期</label>
              <input type="date" className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none" />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">结束日期</label>
              <input type="date" className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">初始资金 (USDT)</label>
            <input type="number" defaultValue={10000} className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm font-mono text-text-primary outline-none" />
          </div>
          <button className="w-full rounded-md bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue/80 transition-colors">
            🚀 开始回测
          </button>
        </div>
      </div>

      <div className="col-span-2 rounded-lg border border-border bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-4">📊 回测结果</h2>
        <div className="text-center text-text-muted text-sm py-32 border border-dashed border-border rounded-lg">
          Phase 5 实现：权益曲线图表 + 绩效指标 + 交易日志
        </div>
      </div>
    </div>
  );
}
