"use client";

import { useWhaleActivity } from "@/hooks/useWhaleActivity";
import { type WhaleActivity, type ParticipantType } from "@/stores/useWhaleStore";

const typeLabels: Record<ParticipantType, { label: string; icon: string; color: string }> = {
  smart_whale: { label: "聊明鲸", icon: "W", color: "text-green" },
  dumb_whale: { label: "愚蠢鲸", icon: "D", color: "text-red" },
  market_maker: { label: "做市商", icon: "M", color: "text-blue" },
  retail_herd: { label: "散户", icon: "R", color: "text-amber" },
  arbitrageur: { label: "套利", icon: "A", color: "text-purple" },
};


function ActivityItem({ activity }: { activity: WhaleActivity }) {
  const typeInfo = typeLabels[activity.participantType] ?? {
    label: activity.participantType,
    icon: "?",
    color: "text-text-muted",
  };
  const isBuy = activity.side === "buy";
  const timeAgo = getTimeAgo(activity.timestamp);

  return (
    <div className="flex items-center gap-2 rounded py-1.5 px-2 hover:bg-bg-hover transition-colors">
      <span className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded bg-bg-tertiary">
        {typeInfo.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={`text-xs font-medium ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
          <span
            className={`text-xs font-mono font-semibold ${
              isBuy ? "text-green" : "text-red"
            }`}
          >
            {isBuy ? "买入" : "卖出"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="font-mono">
            ${(activity.size / 1000).toFixed(0)}K
          </span>
          <span>@</span>
          <span className="font-mono">
            ${activity.price.toLocaleString()}
          </span>
          <span className="capitalize">{activity.exchange}</span>
        </div>
      </div>
      <span className="text-xs text-text-muted whitespace-nowrap">{timeAgo}</span>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

export function WhaleActivityFeed() {
  const { activities, sme, isLoading } = useWhaleActivity(20);

  const hasRealData = activities.length > 0;
  const displayActivities = activities;
  const smeValue = sme?.sme ?? 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-primary">
          Whale Activity
          {isLoading && (
            <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-blue" />
          )}
          {!hasRealData && !isLoading && (
            <span className="ml-2 text-xs text-amber">等待数据...</span>
          )}
        </h3>
        <span
          className={`rounded px-2 py-0.5 text-xs font-mono ${
            smeValue > 1 ? "bg-green/20 text-green" : "bg-red/20 text-red"
          }`}
        >
          SME {smeValue.toFixed(2)}
        </span>
      </div>

      <div className="flex-1 overflow-auto space-y-0.5">
        {displayActivities.length > 0 ? (
          displayActivities.map((a, idx) => (
            <ActivityItem key={a.id || idx} activity={a} />
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
