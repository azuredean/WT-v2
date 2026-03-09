"use client";

import { useQuery } from "@tanstack/react-query";
import { useMarketStore } from "@/stores/useMarketStore";
import { useWhaleActivity } from "@/hooks/useWhaleActivity";
import type { WhaleActivity, ParticipantType } from "@/stores/useWhaleStore";

const BASE_URL = process.env.NEXT_PUBLIC_BFF_URL || "http://localhost:3001";

interface ProfileData {
  type: string;
  count: number;
  totalPnl: number;
  avgLeverage: number;
  longRatio: number;
}

interface ProfilesResponse {
  profiles: ProfileData[];
  error?: string;
}

interface SMEData {
  sme: number;
  smartPnl: number;
  dumbPnl: number;
  retailPnl: number;
}

interface DataQualityScore {
  score: number;
  sourceCoverage: number;
  dataFreshness: number;
  crossValidation: number;
  anomalyFree: number;
  recommendation: "FULL_CONFIDENCE" | "REDUCE_POSITION" | "PAUSE_TRADING";
}

async function fetchProfiles(symbol: string): Promise<ProfilesResponse> {
  const res = await fetch(
    `${BASE_URL}/api/whale/profiles?symbol=${encodeURIComponent(symbol)}`
  );
  if (!res.ok) throw new Error(`Failed to fetch profiles: ${res.status}`);
  return res.json();
}

async function fetchSME(symbol: string): Promise<SMEData> {
  const res = await fetch(
    `${BASE_URL}/api/whale/sme?symbol=${encodeURIComponent(symbol)}`
  );
  if (!res.ok) throw new Error(`Failed to fetch SME: ${res.status}`);
  return res.json();
}

async function fetchDataQuality(symbol: string): Promise<DataQualityScore> {
  const res = await fetch(
    `${BASE_URL}/api/signals/quality?symbol=${encodeURIComponent(symbol)}`
  );
  if (!res.ok) throw new Error(`Failed to fetch data quality: ${res.status}`);
  return res.json();
}

const profileMeta: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  smart_whale: { label: "聊明鲸", icon: "W", color: "text-green" },
  dumb_whale: { label: "愚蠢鲸", icon: "D", color: "text-red" },
  market_maker: { label: "做市商", icon: "M", color: "text-blue" },
  retail_herd: { label: "散户群体", icon: "R", color: "text-amber" },
  arbitrageur: { label: "套利者", icon: "A", color: "text-purple" },
};

// Demo profiles fallback
const demoProfiles = [
  { type: "smart_whale", count: 587, totalPnl: 82300000, avgLeverage: 5.2, longRatio: 0.72 },
  { type: "dumb_whale", count: 817, totalPnl: -37100000, avgLeverage: 8.1, longRatio: 0.65 },
  { type: "market_maker", count: 124, totalPnl: 5200000, avgLeverage: 1.5, longRatio: 0.51 },
  { type: "retail_herd", count: 45000, totalPnl: -18700000, avgLeverage: 10.3, longRatio: 0.68 },
  { type: "arbitrageur", count: 89, totalPnl: 2100000, avgLeverage: 2.1, longRatio: 0.50 },
];

// Demo activities fallback
const demoActivities: WhaleActivity[] = [
  { id: "1", exchange: "binance", symbol: "BTC/USDT", participantType: "smart_whale", side: "buy", size: 2500000, price: 72150, timestamp: Date.now() - 120000 },
  { id: "2", exchange: "okx", symbol: "BTC/USDT", participantType: "dumb_whale", side: "sell", size: 1800000, price: 72200, timestamp: Date.now() - 300000 },
  { id: "3", exchange: "binance", symbol: "BTC/USDT", participantType: "smart_whale", side: "buy", size: 3200000, price: 71900, timestamp: Date.now() - 600000 },
  { id: "4", exchange: "bybit", symbol: "BTC/USDT", participantType: "market_maker", side: "sell", size: 5000000, price: 72100, timestamp: Date.now() - 900000 },
  { id: "5", exchange: "binance", symbol: "BTC/USDT", participantType: "retail_herd", side: "buy", size: 8000, price: 72300, timestamp: Date.now() - 1200000 },
];

function formatPnl(pnl: number): string {
  const abs = Math.abs(pnl);
  const prefix = pnl >= 0 ? "+" : "-";
  if (abs >= 1_000_000) return `${prefix}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${prefix}$${(abs / 1_000).toFixed(0)}K`;
  return `${prefix}$${abs.toFixed(0)}`;
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

export default function WhaleTrackerPage() {
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);

  const profilesQuery = useQuery<ProfilesResponse>({
    queryKey: ["whale", "profiles", selectedSymbol],
    queryFn: () => fetchProfiles(selectedSymbol),
    refetchInterval: 30_000,
    retry: 2,
    staleTime: 15_000,
  });

  const smeQuery = useQuery<SMEData>({
    queryKey: ["whale", "sme", selectedSymbol],
    queryFn: () => fetchSME(selectedSymbol),
    refetchInterval: 30_000,
    retry: 2,
    staleTime: 15_000,
  });

  const dqsQuery = useQuery<DataQualityScore>({
    queryKey: ["signals", "quality", selectedSymbol],
    queryFn: () => fetchDataQuality(selectedSymbol),
    refetchInterval: 60_000,
    retry: 2,
    staleTime: 30_000,
  });

  const { activities, isLoading: activitiesLoading } = useWhaleActivity(50);

  const hasProfiles =
    !!profilesQuery.data &&
    !profilesQuery.error &&
    profilesQuery.data.profiles.length > 0;
  const displayProfiles = hasProfiles
    ? profilesQuery.data.profiles
    : demoProfiles;

  const hasActivities = activities.length > 0;
  const displayActivities = hasActivities ? activities : demoActivities;

  const smeData = smeQuery.data || { sme: 1.0, smartPnl: 0, dumbPnl: 0, retailPnl: 0 };
  const dqsData = dqsQuery.data || { score: 0, sourceCoverage: 0, dataFreshness: 0, crossValidation: 0, anomalyFree: 0, recommendation: "PAUSE_TRADING" as const };

  return (
    <div className="grid grid-cols-1 gap-4 h-full overflow-auto">
      {/* SME Index & Data Quality Banner */}
      <div className="grid grid-cols-3 gap-4">
        {/* SME Index */}
        <div className="rounded-lg border border-border bg-bg-card p-4">
          <h3 className="text-xs text-text-muted mb-2">聪明钱优势指数 (SME)</h3>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold font-mono ${smeData.sme >= 1.0 ? "text-green" : "text-red"}`}>
              {smeData.sme.toFixed(2)}
            </span>
            <span className="text-xs text-text-muted">
              {smeData.sme >= 1.0 ? "聪明钱占优" : "傻钱占优"}
            </span>
          </div>
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-text-muted">聪明鲸浮盈</span>
              <span className={`font-mono ${smeData.smartPnl >= 0 ? "text-green" : "text-red"}`}>
                {formatPnl(smeData.smartPnl)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">愚蠢鲸浮亏</span>
              <span className={`font-mono ${smeData.dumbPnl >= 0 ? "text-green" : "text-red"}`}>
                {formatPnl(smeData.dumbPnl)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">散户估算</span>
              <span className={`font-mono ${smeData.retailPnl >= 0 ? "text-green" : "text-red"}`}>
                {formatPnl(smeData.retailPnl)}
              </span>
            </div>
          </div>
        </div>

        {/* Data Quality Score */}
        <div className="rounded-lg border border-border bg-bg-card p-4">
          <h3 className="text-xs text-text-muted mb-2">数据质量评分 (DQS)</h3>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold font-mono ${
              dqsData.score >= 0.85 ? "text-green" : dqsData.score >= 0.7 ? "text-amber" : "text-red"
            }`}>
              {(dqsData.score * 100).toFixed(0)}%
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              dqsData.recommendation === "FULL_CONFIDENCE" ? "bg-green/20 text-green" :
              dqsData.recommendation === "REDUCE_POSITION" ? "bg-amber/20 text-amber" :
              "bg-red/20 text-red"
            }`}>
              {dqsData.recommendation === "FULL_CONFIDENCE" ? "全仓信心" :
               dqsData.recommendation === "REDUCE_POSITION" ? "减仓建议" : "暂停交易"}
            </span>
          </div>
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-text-muted">数据源覆盖</span>
              <span className="font-mono text-text-secondary">{(dqsData.sourceCoverage * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">数据新鲜度</span>
              <span className="font-mono text-text-secondary">{(dqsData.dataFreshness * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">无异常比例</span>
              <span className="font-mono text-text-secondary">{(dqsData.anomalyFree * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Wealth Flow Summary */}
        <div className="rounded-lg border border-border bg-bg-card p-4">
          <h3 className="text-xs text-text-muted mb-2">财富流向总结</h3>
          <div className="space-y-2">
            {displayProfiles.slice(0, 3).map((p) => {
              const meta = profileMeta[p.type];
              if (!meta) return null;
              const isPositive = p.totalPnl >= 0;
              return (
                <div key={p.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${meta.color}`}>{meta.label}</span>
                    <span className="text-xs text-text-muted">
                      ({p.count.toLocaleString()})
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-mono font-semibold ${isPositive ? "text-green" : "text-red"}`}>
                      {formatPnl(p.totalPnl)}
                    </span>
                    <span className="text-xs">{isPositive ? "✅" : "❌"}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-2 border-t border-border">
            <p className="text-xs text-text-muted">
              {smeData.sme >= 1.5 ? "🟢 聪明钱明确占优，跟随聪明钱方向" :
               smeData.sme >= 1.0 ? "🟡 聪明钱略占优势" :
               "🔴 聪明钱也在亏，谨慎或观望"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-4">
      {/* Participant Profiles */}
      <div className="col-span-1 rounded-lg border border-border bg-bg-card p-4 overflow-auto">
        <h2 className="text-sm font-semibold text-text-primary mb-4">
          参与者画像分布
          {profilesQuery.isLoading && (
            <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-blue" />
          )}
          {!hasProfiles && !profilesQuery.isLoading && (
            <span className="ml-2 text-xs text-text-muted font-normal">
              (demo)
            </span>
          )}
        </h2>
        <div className="space-y-3">
          {displayProfiles.map((p) => {
            const meta = profileMeta[p.type] ?? {
              label: p.type,
              icon: "?",
              color: "text-text-muted",
            };
            return (
              <div
                key={p.type}
                className="flex items-center justify-between rounded-md bg-bg-tertiary p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded bg-bg-primary">
                    {meta.icon}
                  </span>
                  <div>
                    <span className="text-sm">{meta.label}</span>
                    <span className="ml-2 text-xs text-text-muted">
                      ({typeof p.count === "number" ? p.count.toLocaleString() : p.count})
                    </span>
                  </div>
                </div>
                <span
                  className={`font-mono text-sm font-semibold ${
                    p.totalPnl >= 0 ? "text-green" : "text-red"
                  }`}
                >
                  {formatPnl(p.totalPnl)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Stats summary */}
        {hasProfiles && (
          <div className="mt-4 pt-3 border-t border-border space-y-2">
            {displayProfiles.map((p) => {
              const meta = profileMeta[p.type];
              if (!meta) return null;
              return (
                <div
                  key={`stats-${p.type}`}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-text-muted">{meta.label} 多空比</span>
                  <span className="font-mono text-text-secondary">
                    {(p.longRatio * 100).toFixed(0)}% / {((1 - p.longRatio) * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Whale Activity Feed */}
      <div className="col-span-2 rounded-lg border border-border bg-bg-card p-4 overflow-auto">
        <h2 className="text-sm font-semibold text-text-primary mb-4">
          巨鲸活动监控
          {activitiesLoading && (
            <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-blue" />
          )}
          {!hasActivities && !activitiesLoading && (
            <span className="ml-2 text-xs text-text-muted font-normal">
              (demo)
            </span>
          )}
        </h2>

        <div className="space-y-1">
          {displayActivities.map((a, idx) => {
            const meta = profileMeta[a.participantType] ?? {
              label: a.participantType,
              icon: "?",
              color: "text-text-muted",
            };
            const isBuy = a.side === "buy";

            return (
              <div
                key={a.id || idx}
                className="flex items-center gap-3 rounded-md py-2 px-3 hover:bg-bg-hover transition-colors"
              >
                <span className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded bg-bg-tertiary">
                  {meta.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${meta.color}`}>
                      {meta.label}
                    </span>
                    <span
                      className={`text-xs font-mono font-semibold ${
                        isBuy ? "text-green" : "text-red"
                      }`}
                    >
                      {isBuy ? "买入" : "卖出"}
                    </span>
                    <span className="text-xs text-text-muted capitalize">
                      {a.exchange}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                    <span className="font-mono">
                      ${(a.size / 1000).toFixed(0)}K
                    </span>
                    <span>@</span>
                    <span className="font-mono">
                      ${a.price.toLocaleString()}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-text-muted whitespace-nowrap">
                  {getTimeAgo(a.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </div>
  );
}
