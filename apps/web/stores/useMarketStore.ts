import { create } from "zustand";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  amount: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

type Exchange = "binance" | "okx" | "bybit";
type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

interface MarketState {
  selectedSymbol: string;
  selectedExchange: Exchange;
  selectedTimeframe: Timeframe;
  lastPrice: number;
  priceChange24h: number;
  candles: Candle[];
  orderbook: OrderBook | null;

  setSymbol: (symbol: string) => void;
  setExchange: (exchange: Exchange) => void;
  setTimeframe: (timeframe: Timeframe) => void;
  setCandles: (candles: Candle[]) => void;
  updateCandle: (candle: Candle) => void;
  setLastPrice: (price: number) => void;
  setOrderbook: (ob: OrderBook) => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  selectedSymbol: "BTC/USDT",
  selectedExchange: "binance",
  selectedTimeframe: "1h",
  lastPrice: 0,
  priceChange24h: 0,
  candles: [],
  orderbook: null,

  setSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setExchange: (exchange) => set({ selectedExchange: exchange }),
  setTimeframe: (timeframe) => set({ selectedTimeframe: timeframe }),
  setCandles: (candles) => {
    const last = candles[candles.length - 1];
    set({ candles, lastPrice: last?.close ?? 0 });
  },
  updateCandle: (candle) => {
    const { candles } = get();
    const existing = candles.findIndex((c) => c.time === candle.time);
    if (existing >= 0) {
      const updated = [...candles];
      updated[existing] = candle;
      set({ candles: updated, lastPrice: candle.close });
    } else {
      set({ candles: [...candles, candle], lastPrice: candle.close });
    }
  },
  setLastPrice: (price) => set({ lastPrice: price }),
  setOrderbook: (ob) => set({ orderbook: ob }),
}));
