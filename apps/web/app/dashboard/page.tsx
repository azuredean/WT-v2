"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/common/Resizable";
import { CandlestickChart } from "@/features/chart/components/CandlestickChart";
import { SignalOverview } from "@/features/signals/components/SignalOverview";
import { WhaleActivityFeed } from "@/features/whale-tracker/components/WhaleActivityFeed";
import { PositionSummary } from "@/features/trading/components/PositionSummary";

export default function DashboardPage() {
  return (
    <div className="h-full">
      <ResizablePanelGroup direction="vertical">
        {/* Top: Chart + Signal Panel */}
        <ResizablePanel defaultSize={65} minSize={40}>
          <ResizablePanelGroup direction="horizontal">
            {/* Main Chart */}
            <ResizablePanel defaultSize={70} minSize={50}>
              <div className="h-full rounded-lg border border-border bg-bg-card p-3">
                <CandlestickChart />
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Right Panel: Signals + Whale Feed */}
            <ResizablePanel defaultSize={30} minSize={20}>
              <div className="flex h-full flex-col gap-3">
                <div className="flex-1 rounded-lg border border-border bg-bg-card p-3 overflow-auto">
                  <SignalOverview />
                </div>
                <div className="flex-1 rounded-lg border border-border bg-bg-card p-3 overflow-auto">
                  <WhaleActivityFeed />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle />

        {/* Bottom: Positions + Info */}
        <ResizablePanel defaultSize={35} minSize={20}>
          <div className="h-full rounded-lg border border-border bg-bg-card p-3">
            <PositionSummary />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
