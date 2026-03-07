"""Binance exchange adapter using CCXT."""

from typing import Any
import ccxt.async_support as ccxt

from .base import AbstractExchange, ExchangeCandle, ExchangeTicker


class BinanceExchange(AbstractExchange):
    """Binance Futures exchange adapter."""

    name = "binance"

    def __init__(self, api_key: str = "", api_secret: str = ""):
        self.exchange = ccxt.binance({
            "apiKey": api_key,
            "secret": api_secret,
            "enableRateLimit": True,
            "options": {
                "defaultType": "swap",  # Use perpetual futures
            },
        })

    async def connect(self) -> None:
        await self.exchange.load_markets()

    async def disconnect(self) -> None:
        await self.exchange.close()

    async def watch_candles(self, symbol: str, timeframe: str) -> list[ExchangeCandle]:
        # CCXT Pro watch_ohlcv - needs ccxt pro
        ohlcv = await self.exchange.fetch_ohlcv(symbol, timeframe, limit=1)
        return [
            ExchangeCandle(
                time=int(c[0]),
                open=float(c[1]),
                high=float(c[2]),
                low=float(c[3]),
                close=float(c[4]),
                volume=float(c[5]),
            )
            for c in ohlcv
        ]

    async def fetch_candles(
        self, symbol: str, timeframe: str, since: int | None = None, limit: int = 500
    ) -> list[ExchangeCandle]:
        ohlcv = await self.exchange.fetch_ohlcv(
            symbol, timeframe, since=since, limit=limit
        )
        return [
            ExchangeCandle(
                time=int(c[0]),
                open=float(c[1]),
                high=float(c[2]),
                low=float(c[3]),
                close=float(c[4]),
                volume=float(c[5]),
            )
            for c in ohlcv
        ]

    async def fetch_ticker(self, symbol: str) -> ExchangeTicker:
        ticker = await self.exchange.fetch_ticker(symbol)
        return ExchangeTicker(
            symbol=symbol,
            price=float(ticker.get("last", 0)),
            change_24h=float(ticker.get("percentage", 0)),
            volume_24h=float(ticker.get("quoteVolume", 0)),
        )

    async def fetch_orderbook(self, symbol: str, limit: int = 20) -> dict[str, Any]:
        ob = await self.exchange.fetch_order_book(symbol, limit)
        return {
            "bids": ob.get("bids", []),
            "asks": ob.get("asks", []),
            "timestamp": ob.get("timestamp", 0),
        }

    async def fetch_funding_rate(self, symbol: str) -> float:
        try:
            funding = await self.exchange.fetch_funding_rate(symbol)
            return float(funding.get("fundingRate", 0))
        except Exception:
            return 0.0

    async def fetch_open_interest(self, symbol: str) -> float:
        try:
            oi = await self.exchange.fetch_open_interest(symbol)
            return float(oi.get("openInterestValue", 0))
        except Exception:
            return 0.0
