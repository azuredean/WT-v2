"use client";

import { PositionSummary } from "@/features/trading/components/PositionSummary";

export default function PositionsPage() {
  return (
    <div className="h-full space-y-4">
      <div className="rounded-lg border border-border bg-bg-card p-4 h-1/2">
        <PositionSummary />
      </div>

      <div className="grid grid-cols-2 gap-4 h-1/2">
        <div className="rounded-lg border border-border bg-bg-card p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-4">📝 下单面板</h2>
          <div className="text-center text-text-muted text-sm py-16 border border-dashed border-border rounded-lg">
            Phase 6 实现：手动下单 + 一键平仓
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-card p-4">
          <h2 className="text-sm font-semibold text-text-primary mb-4">📊 盈亏统计</h2>
          <div className="text-center text-text-muted text-sm py-16 border border-dashed border-border rounded-lg">
            Phase 6 实现：日/周/月 PnL 图表
          </div>
        </div>
      </div>
    </div>
  );
}
