/**
 * Glassnode free-tier provider
 *
 * IMPORTANT: requires GLASSNODE_API_KEY for live data.
 */

export interface GlassnodeWhaleBalancePoint {
  ts: number;
  value: number;
}

export interface GlassnodeExchangeBalancePoint {
  ts: number;
  value: number;
}

const API_BASE = "https://api.glassnode.com/v1/metrics";

function getApiKey() {
  return process.env.GLASSNODE_API_KEY || "";
}

async function gnFetch(path: string, params: Record<string, string>): Promise<any[] | null> {
  const key = getApiKey();
  if (!key) return null;

  const sp = new URLSearchParams({ ...params, api_key: key });
  try {
    const res = await fetch(`${API_BASE}${path}?${sp.toString()}`);
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json) ? json : null;
  } catch {
    return null;
  }
}

export async function getGlassnodeExchangeBalance(asset = "BTC"): Promise<GlassnodeExchangeBalancePoint[]> {
  const rows = await gnFetch("/distribution/balance_exchanges", { a: asset, i: "24h" });
  if (!rows) return [];
  return rows
    .map((r: any) => ({ ts: Number(r.t ?? 0) * 1000, value: Number(r.v ?? 0) }))
    .filter((x: GlassnodeExchangeBalancePoint) => Number.isFinite(x.ts) && x.ts > 0);
}

export async function getGlassnodeWhaleBalance(asset = "BTC"): Promise<GlassnodeWhaleBalancePoint[]> {
  // Free-tier-friendly proxy metric: large holder supply share (if available)
  const rows = await gnFetch("/supply/whale_balance_sum", { a: asset, i: "24h" });
  if (!rows) return [];
  return rows
    .map((r: any) => ({ ts: Number(r.t ?? 0) * 1000, value: Number(r.v ?? 0) }))
    .filter((x: GlassnodeWhaleBalancePoint) => Number.isFinite(x.ts) && x.ts > 0);
}
