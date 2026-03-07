import { create } from "zustand";

export type SignalDirection = "long" | "short" | "neutral";

export interface StrategySignal {
  strategyId: string;
  name: string;
  direction: SignalDirection;
  strength: number;
  confidence: number;
  metadata?: Record<string, unknown>;
  updatedAt: number;
}

export interface FusedSignal {
  direction: SignalDirection;
  strength: number;
  confidence: number;
  recommendedSize: number;
  strategies: StrategySignal[];
  dataQualityScore: number;
  anomalyFlags: string[];
  timestamp: number;
}

interface SignalState {
  strategies: StrategySignal[];
  fusedSignal: FusedSignal | null;
  dataQualityScore: number;

  setStrategies: (signals: StrategySignal[]) => void;
  updateStrategy: (signal: StrategySignal) => void;
  setFusedSignal: (fused: FusedSignal) => void;
  setDataQualityScore: (score: number) => void;
}

export const useSignalStore = create<SignalState>((set, get) => ({
  strategies: [],
  fusedSignal: null,
  dataQualityScore: 0,

  setStrategies: (strategies) => set({ strategies }),
  updateStrategy: (signal) => {
    const { strategies } = get();
    const idx = strategies.findIndex((s) => s.strategyId === signal.strategyId);
    if (idx >= 0) {
      const updated = [...strategies];
      updated[idx] = signal;
      set({ strategies: updated });
    } else {
      set({ strategies: [...strategies, signal] });
    }
  },
  setFusedSignal: (fusedSignal) =>
    set({ fusedSignal, dataQualityScore: fusedSignal.dataQualityScore }),
  setDataQualityScore: (score) => set({ dataQualityScore: score }),
}));
