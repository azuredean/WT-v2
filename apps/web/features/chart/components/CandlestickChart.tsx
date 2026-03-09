"use client";

import { useEffect, useRef, memo } from "react";
import { useMarketStore } from "@/stores/useMarketStore";

// Map our symbol format to TradingView format
function toTradingViewSymbol(symbol: string, exchange: string): string {
  const clean = symbol.replace("/", "");
  const exchangeMap: Record<string, string> = {
    binance: "BINANCE",
    okx: "OKX",
    bybit: "BYBIT",
  };
  const tvExchange = exchangeMap[exchange] || "BINANCE";
  return `${tvExchange}:${clean}`;
}

// Map our timeframes to TradingView intervals
function toTradingViewInterval(timeframe: string): string {
  const map: Record<string, string> = {
    "1m": "1",
    "5m": "5",
    "15m": "15",
    "1h": "60",
    "4h": "240",
    "1d": "D",
  };
  return map[timeframe] || "60";
}

function CandlestickChartInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { selectedSymbol, selectedExchange, selectedTimeframe } =
    useMarketStore();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    container.innerHTML = "";

    const tvSymbol = toTradingViewSymbol(selectedSymbol, selectedExchange);
    const interval = toTradingViewInterval(selectedTimeframe);

    // Create TradingView Advanced Chart widget container
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";

    const widgetInner = document.createElement("div");
    widgetInner.className = "tradingview-widget-container__widget";
    widgetInner.style.height = "calc(100% - 32px)";
    widgetInner.style.width = "100%";
    widgetContainer.appendChild(widgetInner);

    container.appendChild(widgetContainer);

    // Load TradingView embed script
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "zh_CN",
      backgroundColor: "rgba(15, 17, 23, 1)",
      gridColor: "rgba(42, 46, 63, 0.5)",
      allow_symbol_change: true,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
      studies: ["Volume@tv-basicstudies"],
    });

    widgetContainer.appendChild(script);

    // Cleanup: remove the widget container on dependency change / unmount.
    // Use requestAnimationFrame to let TradingView's postMessage handlers
    // finish before the iframe is destroyed, preventing "contentWindow is
    // not available" errors.
    return () => {
      requestAnimationFrame(() => {
        if (widgetContainer.parentNode) {
          widgetContainer.parentNode.removeChild(widgetContainer);
        }
      });
    };
  }, [selectedSymbol, selectedExchange, selectedTimeframe]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-secondary">
          {selectedSymbol} · {selectedTimeframe} · {selectedExchange}
        </h3>
        <span className="text-xs text-text-muted">TradingView</span>
      </div>
      <div
        ref={containerRef}
        className="flex-1"
        style={{ minHeight: "300px" }}
      />
    </div>
  );
}

export const CandlestickChart = memo(CandlestickChartInner);
