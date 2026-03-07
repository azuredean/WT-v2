"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  CrosshairMode,
  type CandlestickData,
  type HistogramData,
  type Time,
} from "lightweight-charts";
import { useMarketStore, type Candle } from "@/stores/useMarketStore";
import { api } from "@/lib/api-client";
import { getWSClient } from "@/lib/ws-client";

function toChartCandle(c: Candle): CandlestickData<Time> {
  return {
    time: (c.time / 1000) as Time, // lightweight-charts expects seconds
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}

function toVolumeBar(c: Candle): HistogramData<Time> {
  return {
    time: (c.time / 1000) as Time,
    value: c.volume,
    color: c.close >= c.open ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
  };
}

export function CandlestickChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const { selectedSymbol, selectedExchange, selectedTimeframe, candles, setCandles, updateCandle } =
    useMarketStore();

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: "rgba(42, 46, 63, 0.5)" },
        horzLines: { color: "rgba(42, 46, 63, 0.5)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(59, 130, 246, 0.4)", width: 1, style: 2 },
        horzLine: { color: "rgba(59, 130, 246, 0.4)", width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: "#2a2e3f",
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "#2a2e3f",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: { axisPressedMouseMove: true },
      handleScroll: { vertTouchDrag: true },
    });

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    // Volume series (overlay at bottom)
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Auto-resize
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // Fetch historical candles when symbol/timeframe/exchange changes
  useEffect(() => {
    let cancelled = false;

    async function fetchCandles() {
      try {
        const res = await api.market.candles(selectedSymbol, selectedTimeframe, 500);
        if (!cancelled && res.data) {
          setCandles(
            res.data.map((c) => ({
              time: c.time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volume,
            }))
          );
        }
      } catch (err) {
        // API might not be running yet — load demo data
        if (!cancelled) {
          loadDemoData();
        }
      }
    }

    fetchCandles();
    return () => { cancelled = true; };
  }, [selectedSymbol, selectedTimeframe, selectedExchange, setCandles]);

  // Update chart when candles change
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    candleSeriesRef.current.setData(candles.map(toChartCandle));
    volumeSeriesRef.current.setData(candles.map(toVolumeBar));
  }, [candles]);

  // Subscribe to real-time updates via WebSocket
  useEffect(() => {
    const ws = getWSClient();
    const channel = `market:${selectedSymbol.replace("/", "")}:candle:${selectedTimeframe}`;

    const unsub = ws.subscribe(channel, (data) => {
      const c = data as Candle;
      updateCandle(c);

      // Update chart in real-time
      if (candleSeriesRef.current) {
        candleSeriesRef.current.update(toChartCandle(c));
      }
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.update(toVolumeBar(c));
      }
    });

    return unsub;
  }, [selectedSymbol, selectedTimeframe, updateCandle]);

  const loadDemoData = useCallback(() => {
    // Generate demo candles for development
    const now = Date.now();
    const interval = 3600 * 1000; // 1h
    const demoCandles: Candle[] = [];
    let price = 72000;

    for (let i = 500; i >= 0; i--) {
      const change = (Math.random() - 0.48) * 500;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * 300;
      const low = Math.min(open, close) - Math.random() * 300;
      const volume = 100 + Math.random() * 2000;

      demoCandles.push({
        time: now - i * interval,
        open,
        high,
        low,
        close,
        volume,
      });

      price = close;
    }

    setCandles(demoCandles);
  }, [setCandles]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-secondary">
          {selectedSymbol} · {selectedTimeframe} · {selectedExchange}
        </h3>
      </div>
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
