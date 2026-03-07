"""Bybit exchange adapter using CCXT."""

from typing import Any
import ccxt.async_support as ccxt

from .base import AbstractExchange, ExchangeCandle, ExchangeTicker


class BybitExchange(AbstractExchange):
    """Bybit Futures exchange adapter."""

    name = "bybit"

    def __init__(self, api_key: str = "", api_secret: str = ""):
        self.exchange = ccxt.bybit({
            "apiKey": api_key,
            "secret": api_secret,
            "enableRateLimit": True,
            "options": {"defaultType": "swap"},
        })

    async def connect(self) -> None:
        await self.exchange.load_markets()

    async def disconnect(self) -> None:
        await self.exchange.close()

    async def watch_candles(self, symbol: str, timeframe: str) -> list[ExchangeCandle]:
        ohlcv = await self.exchange.fetch_ohlcv(symbol, timeframe, limit=1)
        return [ExchangeCandle(int(c[0]), float(c[1]), float(c[2]), float(c[3]), float(c[4]), float(c[5])) for c in ohlcv]

    async def fetch_candles(self, symbol: str, timeframe: str, since: int | None = None, limit: int = 500) -> list[ExchangeCandle]:
        ohlcv = await self.exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=limit)
        return [ExchangeCandle(int(c[0]), float(c[1]), float(c[2]), float(c[3]), float(c[4]), float(c[5])) for c in ohlcv]

    async def fetch_ticker(self, symbol: str) -> ExchangeTicker:
        t = await self.exchange.fetch_ticker(symbol)
        return ExchangeTicker(symbol, float(t.get("last", 0)), float(t.get("percentage", 0)), float(t.get("quoteVolume", 0)))

    async def fetch_orderbook(self, symbol: str, limit: int = 20) -> dict[str, Any]:
        ob = await self.exchange.fetch_order_book(symbol, limit)
        return {"bids": ob.get("bids", []), "asks": ob.get("asks", []), "timestamp": ob.get("timestamp", 0)}

    async def fetch_funding_rate(self, symbol: str) -> float:
        try:
            f = await self.exchange.fetch_funding_rate(symbol)
            return float(f.get("fundingRate", 0))
        except Exception:
            return 0.0

    async def fetch_open_interest(self, symbol: str) -> float:
        try:
            oi = await self.exchange.fetch_open_interest(symbol)
            return float(oi.get("openInterestValue", 0))
        except Exception:
            return 0.0
