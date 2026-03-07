// Market types
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

export type Exchange = "binance" | "okx" | "bybit";
export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

// Signal types
export type SignalDirection = "long" | "short" | "neutral";

export interface StrategySignal {
  strategyId: string;
  name: string;
  direction: SignalDirection;
  strength: number;
  confidence: number;
}

export interface FusedSignal {
  direction: SignalDirection;
  strength: number;
  confidence: number;
  recommendedSize: number;
  dataQualityScore: number;
  strategies: StrategySignal[];
  anomalyFlags: string[];
  timestamp: number;
}

// Participant types
export type ParticipantType =
  | "smart_whale"
  | "dumb_whale"
  | "market_maker"
  | "retail_herd"
  | "arbitrageur";

export interface WhaleActivity {
  id: string;
  exchange: Exchange;
  symbol: string;
  participantType: ParticipantType;
  side: "buy" | "sell";
  size: number;
  price: number;
  timestamp: number;
}

// WebSocket message
export interface WSMessage<T = unknown> {
  channel: string;
  event: "data" | "snapshot" | "error" | "connected";
  timestamp: number;
  data: T;
  sequence?: number;
}
