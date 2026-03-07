import { create } from "zustand";

export interface Position {
  id: string;
  exchange: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  marginUsed: number;
  liquidationPrice: number;
  openedAt: number;
}

export interface Trade {
  id: string;
  exchange: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPct: number;
  entryTime: number;
  exitTime: number;
  signalId?: string;
}

interface TradeState {
  positions: Position[];
  recentTrades: Trade[];
  totalPnl: number;
  totalPnlToday: number;

  setPositions: (positions: Position[]) => void;
  updatePosition: (position: Position) => void;
  setRecentTrades: (trades: Trade[]) => void;
}

export const useTradeStore = create<TradeState>((set, get) => ({
  positions: [],
  recentTrades: [],
  totalPnl: 0,
  totalPnlToday: 0,

  setPositions: (positions) => {
    const totalPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    set({ positions, totalPnl });
  },
  updatePosition: (position) => {
    const { positions } = get();
    const idx = positions.findIndex((p) => p.id === position.id);
    if (idx >= 0) {
      const updated = [...positions];
      updated[idx] = position;
      const totalPnl = updated.reduce((sum, p) => sum + p.unrealizedPnl, 0);
      set({ positions: updated, totalPnl });
    }
  },
  setRecentTrades: (recentTrades) => set({ recentTrades }),
}));
