/**
 * CoinGlass free-tier provider
 *
 * IMPORTANT: requires COINGLASS_API_KEY for live data.
 * Falls back to empty-safe values when key is absent.
 */

export interface CoinGlassLiquidationPoint {
  ts: number;
  longLiqUsd: number;
  shortLiqUsd: number;
}

export interface CoinGlassExchangeFlow {
  ts: number;
  inflowUsd: number;
  outflowUsd: number;
}

const API_BASE = "https://open-api-v4.coinglass.com/api";

function getApiKey() {
  return process.env.COINGLASS_API_KEY || "";
}

async function cgFetch<T>(path: string): Promise<T | null> {
  const key = getApiKey();
  if (!key) return null;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        accept: "application/json",
        "CG-API-KEY": key,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getCoinGlassLiquidationHistory(symbol: string): Promise<CoinGlassLiquidationPoint[]> {
  // Free-tier endpoint shape can change; normalize defensively.
  // symbol normalization: BTCUSDT
  const normalized = symbol.replace("/", "");
  const resp = await cgFetch<any>(`/futures/liquidation/chart?symbol=${encodeURIComponent(normalized)}&interval=1h`);
  const list = resp?.data ?? [];
  if (!Array.isArray(list)) return [];

  return list
    .map((x: any) => ({
      ts: Number(x.t ?? x.time ?? 0),
      longLiqUsd: Number(x.longUsd ?? x.longLiquidationUsd ?? x.long ?? 0),
      shortLiqUsd: Number(x.shortUsd ?? x.shortLiquidationUsd ?? x.short ?? 0),
    }))
    .filter((x: CoinGlassLiquidationPoint) => Number.isFinite(x.ts) && x.ts > 0);
}

export async function getCoinGlassExchangeFlow(symbol: string): Promise<CoinGlassExchangeFlow[]> {
  const normalized = symbol.replace("/", "");
  const resp = await cgFetch<any>(`/spot/exchange-netflow/chart?symbol=${encodeURIComponent(normalized)}&interval=1h`);
  const list = resp?.data ?? [];
  if (!Array.isArray(list)) return [];

  return list
    .map((x: any) => ({
      ts: Number(x.t ?? x.time ?? 0),
      inflowUsd: Number(x.inflowUsd ?? x.inflow ?? 0),
      outflowUsd: Number(x.outflowUsd ?? x.outflow ?? 0),
    }))
    .filter((x: CoinGlassExchangeFlow) => Number.isFinite(x.ts) && x.ts > 0);
}
