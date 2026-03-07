"""Strategy plugin interface — the core contract for all trading strategies."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import pandas as pd


class SignalDirection(Enum):
    LONG = "long"
    SHORT = "short"
    NEUTRAL = "neutral"


@dataclass
class StrategySignal:
    """Output of a single strategy evaluation."""

    direction: SignalDirection
    strength: float  # -1.0 to 1.0 (negative = short confidence, positive = long)
    confidence: float  # 0.0 to 1.0
    metadata: dict[str, Any] = field(default_factory=dict)


class IStrategy(ABC):
    """Base interface for all trading strategies (plugin contract).

    All 8 built-in strategies and user plugins must implement this interface.
    The signal fusion engine calls `populate_indicators` followed by
    `generate_signal` on each candle close.
    """

    # Strategy metadata — subclasses must set these
    name: str = "base_strategy"
    version: str = "1.0.0"
    description: str = ""
    required_data: list[str] = []  # e.g. ['candles', 'funding_rate', 'oi', 'orderbook']
    min_candles: int = 50  # minimum candle history needed

    @abstractmethod
    def populate_indicators(self, df: pd.DataFrame, context: dict[str, Any]) -> pd.DataFrame:
        """Add technical indicators to the dataframe.

        Args:
            df: OHLCV DataFrame with columns [time, open, high, low, close, volume]
            context: Additional data (funding_rate, oi, orderbook, whale_data, etc.)

        Returns:
            DataFrame with added indicator columns
        """
        ...

    @abstractmethod
    def generate_signal(self, df: pd.DataFrame, context: dict[str, Any]) -> StrategySignal:
        """Generate a trading signal from the enriched dataframe.

        Args:
            df: DataFrame with indicators (output of populate_indicators)
            context: Same context dict

        Returns:
            StrategySignal with direction, strength, and confidence
        """
        ...

    def validate_data(self, df: pd.DataFrame, context: dict[str, Any]) -> float:
        """Return data quality score for this strategy (0.0 to 1.0).

        Override for custom validation. Default checks basic data completeness.
        """
        if len(df) < self.min_candles:
            return 0.0

        # Check for NaN values in required columns
        required_cols = ["open", "high", "low", "close", "volume"]
        nan_ratio = df[required_cols].isna().sum().sum() / (len(df) * len(required_cols))
        return max(0.0, 1.0 - nan_ratio)
