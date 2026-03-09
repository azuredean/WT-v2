import { describe, it, expect } from "vitest";
import {
  updateStrategyWeights,
  updateStrategyEnabled,
  getStrategyConfigs,
} from "./signal-engine.js";

describe("signal-engine runtime config", () => {
  it("updates strategy weights", () => {
    const updated = updateStrategyWeights({ s1_whale_tracking: 0.33 });
    expect(updated.s1_whale_tracking).toBeCloseTo(0.33, 5);
  });

  it("updates strategy enabled flags", () => {
    const updated = updateStrategyEnabled({ s8_smart_money_edge: false });
    expect(updated.s8_smart_money_edge).toBe(false);
    // restore
    updateStrategyEnabled({ s8_smart_money_edge: true });
  });

  it("returns configs with weights and enabled", () => {
    const cfg = getStrategyConfigs();
    expect(cfg.length).toBeGreaterThanOrEqual(8);
    expect(cfg[0]).toHaveProperty("weight");
    expect(cfg[0]).toHaveProperty("enabled");
  });
});
