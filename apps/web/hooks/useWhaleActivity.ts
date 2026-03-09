"use client";

import { useQuery } from "@tanstack/react-query";
import { useMarketStore } from "@/stores/useMarketStore";
import type { WhaleActivity } from "@/stores/useWhaleStore";

const BASE_URL = process.env.NEXT_PUBLIC_BFF_URL || "http://localhost:3001";

export interface WhaleActivityResponse {
  activities: WhaleActivity[];
  error?: string;
}

export interface SMEResponse {
  sme: number;
  smartPnl: number;
  dumbPnl: number;
  retailPnl: number;
  error?: string;
}

async function fetchWhaleActivity(
  symbol: string,
  limit: number
): Promise<WhaleActivityResponse> {
  const res = await fetch(
    `${BASE_URL}/api/whale/activity?symbol=${encodeURIComponent(symbol)}&limit=${limit}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch whale activity: ${res.status}`);
  }
  return res.json();
}

async function fetchSME(symbol: string): Promise<SMEResponse> {
  const res = await fetch(
    `${BASE_URL}/api/whale/sme?symbol=${encodeURIComponent(symbol)}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch SME: ${res.status}`);
  }
  return res.json();
}

export function useWhaleActivity(limit = 20) {
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);

  const activityQuery = useQuery<WhaleActivityResponse>({
    queryKey: ["whale", "activity", selectedSymbol, limit],
    queryFn: () => fetchWhaleActivity(selectedSymbol, limit),
    refetchInterval: 15_000,
    retry: 2,
    staleTime: 10_000,
  });

  const smeQuery = useQuery<SMEResponse>({
    queryKey: ["whale", "sme", selectedSymbol],
    queryFn: () => fetchSME(selectedSymbol),
    refetchInterval: 30_000,
    retry: 2,
    staleTime: 15_000,
  });

  return {
    activities: activityQuery.data?.activities ?? [],
    activitiesLoading: activityQuery.isLoading,
    activitiesError: activityQuery.error,
    sme: smeQuery.data ?? null,
    smeLoading: smeQuery.isLoading,
    smeError: smeQuery.error,
    isLoading: activityQuery.isLoading || smeQuery.isLoading,
  };
}
