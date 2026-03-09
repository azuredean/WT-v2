"use client";

import { useEffect, useMemo, useState } from "react";

export default function SettingsPage() {
  const BASE_URL = process.env.NEXT_PUBLIC_BFF_URL || "http://localhost:3001";

  const [weights, setWeights] = useState([
    { id: "s1_whale_tracking", name: "S1 巨鲸跟单", weight: 20 },
    { id: "s2_capital_concentration", name: "S2 资金集中", weight: 15 },
    { id: "s3_funding_reversal", name: "S3 资金费反转", weight: 12 },
    { id: "s4_liquidity_grab", name: "S4 清算级联", weight: 10 },
    { id: "s5_oi_divergence", name: "S5 OI背离", weight: 8 },
    { id: "s6_retail_counter", name: "S6 散户反向", weight: 15 },
    { id: "s7_stop_hunt", name: "S7 止损猎杀", weight: 10 },
    { id: "s8_smart_money_edge", name: "S8 聪明钱优势", weight: 10 },
  ]);
  const [anomaly, setAnomaly] = useState({ flashCrashPct: 5, zScore: 3, pauseHours: 24 });

  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  const [savingWeights, setSavingWeights] = useState(false);
  const [savingAnomaly, setSavingAnomaly] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/signals/strategies`);
        if (!res.ok) return;
        const json = await res.json();
        const serverStrategies = Array.isArray(json?.strategies) ? json.strategies : [];
        if (serverStrategies.length > 0) {
          setWeights((prev) =>
            prev.map((p) => {
              const s = serverStrategies.find((x: any) => x.id === p.id);
              return s ? { ...p, weight: Math.round(Number(s.weight || 0) * 100) } : p;
            })
          );
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const canSaveWeights = useMemo(() => totalWeight > 0, [totalWeight]);

  function updateWeight(id: string, val: number) {
    setWeights((prev) => prev.map((w) => (w.id === id ? { ...w, weight: val } : w)));
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-lg font-semibold text-text-primary">⚙️ 设置</h1>

      {/* Exchange API Keys */}
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-4">交易所 API 配置</h2>
        {["Binance", "OKX", "Bybit"].map((exchange) => (
          <div key={exchange} className="mb-4 last:mb-0 rounded-md bg-bg-tertiary p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{exchange}</span>
              <span className="text-xs text-text-muted rounded px-2 py-0.5 bg-bg-hover">
                未连接
              </span>
            </div>
            <div className="space-y-2">
              <input placeholder="API Key" className="w-full rounded border border-border bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none" />
              <input placeholder="API Secret" type="password" className="w-full rounded border border-border bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none" />
              {exchange === "OKX" && (
                <input placeholder="Passphrase" type="password" className="w-full rounded border border-border bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none" />
              )}
            </div>
          </div>
        ))}
        <button className="mt-2 rounded-md bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue/80 transition-colors">
          保存配置
        </button>
      </div>

      {/* Strategy Weights */}
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-4">策略权重配置</h2>
        <div className="space-y-3">
          {weights.map((w) => (
            <div key={w.id} className="grid grid-cols-[1fr_90px] gap-3 items-center">
              <label className="text-sm text-text-secondary">{w.name}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={w.weight}
                onChange={(e) => updateWeight(w.id, Number(e.target.value || 0))}
                className="rounded border border-border bg-bg-primary px-2 py-1 text-sm text-text-primary"
              />
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs">
          <span className={totalWeight === 100 ? "text-green" : "text-amber"}>
            权重总和：{totalWeight}% {totalWeight === 100 ? "✅" : "(建议=100)"}
          </span>
        </div>
        <button
          disabled={!canSaveWeights || savingWeights}
          onClick={async () => {
            setSavingWeights(true);
            setMsg("");
            try {
              const weightMap = Object.fromEntries(weights.map((w) => [w.id, w.weight / 100]));
              const res = await fetch(`${BASE_URL}/api/signals/strategies/weights`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ weights: weightMap }),
              });
              if (!res.ok) throw new Error("保存失败");
              setMsg("策略权重已保存");
            } catch {
              setMsg("策略权重保存失败");
            } finally {
              setSavingWeights(false);
            }
          }}
          className="mt-3 rounded-md bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue/80 transition-colors disabled:opacity-50"
        >
          {savingWeights ? "保存中..." : "保存策略权重"}
        </button>
      </div>

      {/* Anomaly Detection */}
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-4">异常检测阈值</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-text-muted">闪崩阈值 (%)</label>
            <input
              type="number"
              value={anomaly.flashCrashPct}
              onChange={(e) => setAnomaly((v) => ({ ...v, flashCrashPct: Number(e.target.value || 0) }))}
              className="mt-1 w-full rounded border border-border bg-bg-primary px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Z-Score 阈值</label>
            <input
              type="number"
              step="0.1"
              value={anomaly.zScore}
              onChange={(e) => setAnomaly((v) => ({ ...v, zScore: Number(e.target.value || 0) }))}
              className="mt-1 w-full rounded border border-border bg-bg-primary px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">熔断时长 (h)</label>
            <input
              type="number"
              value={anomaly.pauseHours}
              onChange={(e) => setAnomaly((v) => ({ ...v, pauseHours: Number(e.target.value || 0) }))}
              className="mt-1 w-full rounded border border-border bg-bg-primary px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <button
          onClick={async () => {
            setSavingAnomaly(true);
            setMsg("");
            try {
              localStorage.setItem("wtv2_anomaly_settings", JSON.stringify(anomaly));
              setMsg("异常参数已保存（本地）");
            } catch {
              setMsg("异常参数保存失败");
            } finally {
              setSavingAnomaly(false);
            }
          }}
          className="mt-3 rounded-md bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue/80 transition-colors disabled:opacity-50"
          disabled={savingAnomaly}
        >
          {savingAnomaly ? "保存中..." : "保存异常参数"}
        </button>
        {msg && <div className="mt-2 text-xs text-text-muted">{msg}</div>}
      </div>
    </div>
  );
}
