"use client";

import { useQuery } from "@tanstack/react-query";
import { useMarketStore } from "@/stores/useMarketStore";

const BASE_URL = process.env.NEXT_PUBLIC_BFF_URL || "http://localhost:3001";

export interface StrategyResult {
  id: string;
  name: string;
  direction: "long" | "short" | "neutral";
  strength: number;
  confidence: number;
  reason: string;
}

export interface FusedSignalResponse {
  symbol: string;
  direction: "long" | "short" | "neutral";
  strength: number;
  confidence: number;
  recommendedSize: number;
  dataQualityScore: number;
  strategies: StrategyResult[];
  timestamp: number;
  error?: string;
}

async function fetchSignals(symbol: string): Promise<FusedSignalResponse> {
  const res = await fetch(
    `${BASE_URL}/api/signals/current?symbol=${encodeURIComponent(symbol)}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch signals: ${res.status}`);
  }
  return res.json();
}

export function useSignals() {
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);

  return useQuery<FusedSignalResponse>({
    queryKey: ["signals", "current", selectedSymbol],
    queryFn: () => fetchSignals(selectedSymbol),
    refetchInterval: 30_000,
    retry: 2,
    staleTime: 15_000,
  });
}
