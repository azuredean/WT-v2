"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useMarketStore } from "@/stores/useMarketStore";

const BASE_URL = process.env.NEXT_PUBLIC_BFF_URL || "http://localhost:3001";

export interface TickerResponse {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

async function fetchTicker(symbol: string): Promise<TickerResponse> {
  const res = await fetch(
    `${BASE_URL}/api/market/ticker?symbol=${encodeURIComponent(symbol)}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch ticker: ${res.status}`);
  }
  return res.json();
}

export function useMarketData() {
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const setLastPrice = useMarketStore((s) => s.setLastPrice);

  const query = useQuery<TickerResponse>({
    queryKey: ["market", "ticker", selectedSymbol],
    queryFn: () => fetchTicker(selectedSymbol),
    refetchInterval: 10_000,
    retry: 2,
    staleTime: 5_000,
  });

  // Sync price to the market store so other components can read it
  useEffect(() => {
    if (query.data?.price && query.data.price > 0) {
      setLastPrice(query.data.price);
    }
  }, [query.data?.price, setLastPrice]);

  return {
    ticker: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
