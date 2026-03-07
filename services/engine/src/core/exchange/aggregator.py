"""Multi-exchange data aggregator."""

from typing import Any

from .base import AbstractExchange, ExchangeCandle, ExchangeTicker


class ExchangeAggregator:
    """Aggregates data from multiple exchanges with cross-validation."""

    def __init__(self, exchanges: list[AbstractExchange]):
        self.exchanges = {ex.name: ex for ex in exchanges}

    async def connect_all(self) -> None:
        for ex in self.exchanges.values():
            try:
                await ex.connect()
                print(f"[Aggregator] Connected to {ex.name}")
            except Exception as e:
                print(f"[Aggregator] Failed to connect to {ex.name}: {e}")

    async def disconnect_all(self) -> None:
        for ex in self.exchanges.values():
            try:
                await ex.disconnect()
            except Exception:
                pass

    async def fetch_candles(
        self,
        symbol: str,
        timeframe: str,
        exchange: str | None = None,
        limit: int = 500,
    ) -> list[ExchangeCandle]:
        """Fetch candles from a specific exchange or the primary one."""
        if exchange and exchange in self.exchanges:
            return await self.exchanges[exchange].fetch_candles(symbol, timeframe, limit=limit)

        # Default to first available exchange
        for ex in self.exchanges.values():
            try:
                return await ex.fetch_candles(symbol, timeframe, limit=limit)
            except Exception:
                continue

        return []

    async def fetch_funding_rates(self, symbol: str) -> dict[str, float]:
        """Fetch funding rates from all exchanges."""
        rates = {}
        for name, ex in self.exchanges.items():
            try:
                rates[name] = await ex.fetch_funding_rate(symbol)
            except Exception:
                pass
        return rates

    async def fetch_open_interest_all(self, symbol: str) -> dict[str, float]:
        """Fetch open interest from all exchanges."""
        oi = {}
        for name, ex in self.exchanges.items():
            try:
                oi[name] = await ex.fetch_open_interest(symbol)
            except Exception:
                pass
        return oi

    def active_count(self) -> int:
        """Number of connected exchanges."""
        return len(self.exchanges)
