import { create } from "zustand";

export type ParticipantType =
  | "smart_whale"
  | "dumb_whale"
  | "market_maker"
  | "retail_herd"
  | "arbitrageur";

export interface WhaleActivity {
  id: string;
  exchange: string;
  symbol: string;
  participantType: ParticipantType;
  side: "buy" | "sell";
  size: number;
  price: number;
  timestamp: number;
}

export interface ParticipantProfile {
  type: ParticipantType;
  count: number;
  totalPnl: number;
  avgLeverage: number;
  longRatio: number;
}

export interface SmartMoneyEdge {
  sme: number;
  smartPnl: number;
  dumbPnl: number;
  retailPnl: number;
}

interface WhaleState {
  activities: WhaleActivity[];
  profiles: ParticipantProfile[];
  smartMoneyEdge: SmartMoneyEdge | null;

  addActivity: (activity: WhaleActivity) => void;
  setProfiles: (profiles: ParticipantProfile[]) => void;
  setSmartMoneyEdge: (sme: SmartMoneyEdge) => void;
}

export const useWhaleStore = create<WhaleState>((set, get) => ({
  activities: [],
  profiles: [],
  smartMoneyEdge: null,

  addActivity: (activity) => {
    const { activities } = get();
    // Keep last 100 activities
    const updated = [activity, ...activities].slice(0, 100);
    set({ activities: updated });
  },
  setProfiles: (profiles) => set({ profiles }),
  setSmartMoneyEdge: (smartMoneyEdge) => set({ smartMoneyEdge }),
}));
