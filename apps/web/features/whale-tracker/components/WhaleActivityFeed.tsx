"use client";

import { useWhaleStore, type WhaleActivity, type ParticipantType } from "@/stores/useWhaleStore";

const typeLabels: Record<ParticipantType, { label: string; icon: string; color: string }> = {
  smart_whale: { label: "聊明鲸", icon: "🧠", color: "text-green" },
  dumb_whale: { label: "愚蠢鲸", icon: "🤡", color: "text-red" },
  market_maker: { label: "做市商", icon: "🏦", color: "text-blue" },
  retail_herd: { label: "散户", icon: "👥", color: "text-amber" },
  arbitrageur: { label: "套利", icon: "🔄", color: "text-purple" },
};

function ActivityItem({ activity }: { activity: WhaleActivity }) {
  const typeInfo = typeLabels[activity.participantType];
  const isBuy = activity.side === "buy";
  const timeAgo = getTimeAgo(activity.timestamp);

  return (
    <div className="flex items-center gap-2 rounded py-1.5 px-2 hover:bg-bg-hover transition-colors">
      <span className="text-base">{typeInfo.icon}</span>
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
  const { activities, smartMoneyEdge } = useWhaleStore();

  // Demo data
  const demoActivities: WhaleActivity[] =
    activities.length > 0
      ? activities
      : [
          { id: "1", exchange: "binance", symbol: "BTC/USDT", participantType: "smart_whale", side: "buy", size: 2500000, price: 72150, timestamp: Date.now() - 120000 },
          { id: "2", exchange: "okx", symbol: "BTC/USDT", participantType: "dumb_whale", side: "sell", size: 1800000, price: 72200, timestamp: Date.now() - 300000 },
          { id: "3", exchange: "binance", symbol: "BTC/USDT", participantType: "smart_whale", side: "buy", size: 3200000, price: 71900, timestamp: Date.now() - 600000 },
          { id: "4", exchange: "bybit", symbol: "BTC/USDT", participantType: "market_maker", side: "sell", size: 5000000, price: 72100, timestamp: Date.now() - 900000 },
          { id: "5", exchange: "binance", symbol: "BTC/USDT", participantType: "retail_herd", side: "buy", size: 8000, price: 72300, timestamp: Date.now() - 1200000 },
          { id: "6", exchange: "okx", symbol: "BTC/USDT", participantType: "smart_whale", side: "buy", size: 4100000, price: 71850, timestamp: Date.now() - 1800000 },
        ];

  const sme = smartMoneyEdge?.sme ?? 1.47;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-primary">🐳 Whale Activity</h3>
        <span
          className={`rounded px-2 py-0.5 text-xs font-mono ${
            sme > 1 ? "bg-green/20 text-green" : "bg-red/20 text-red"
          }`}
        >
          SME {sme.toFixed(2)}
        </span>
      </div>

      <div className="flex-1 overflow-auto space-y-0.5">
        {demoActivities.map((a) => (
          <ActivityItem key={a.id} activity={a} />
        ))}
      </div>
    </div>
  );
}
