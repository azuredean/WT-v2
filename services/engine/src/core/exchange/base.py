"""Abstract exchange interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class ExchangeCandle:
    time: int  # milliseconds
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass
class ExchangeTicker:
    symbol: str
    price: float
    change_24h: float
    volume_24h: float


class AbstractExchange(ABC):
    """Base interface for exchange adapters."""

    name: str = "base"

    @abstractmethod
    async def connect(self) -> None:
        """Establish WebSocket connection."""
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """Close WebSocket connection."""
        ...

    @abstractmethod
    async def watch_candles(self, symbol: str, timeframe: str) -> list[ExchangeCandle]:
        """Subscribe to real-time candle updates."""
        ...

    @abstractmethod
    async def fetch_candles(
        self, symbol: str, timeframe: str, since: int | None = None, limit: int = 500
    ) -> list[ExchangeCandle]:
        """Fetch historical candles."""
        ...

    @abstractmethod
    async def fetch_ticker(self, symbol: str) -> ExchangeTicker:
        """Fetch current ticker."""
        ...

    @abstractmethod
    async def fetch_orderbook(self, symbol: str, limit: int = 20) -> dict[str, Any]:
        """Fetch orderbook."""
        ...

    @abstractmethod
    async def fetch_funding_rate(self, symbol: str) -> float:
        """Fetch current funding rate."""
        ...

    @abstractmethod
    async def fetch_open_interest(self, symbol: str) -> float:
        """Fetch current open interest in USD."""
        ...
