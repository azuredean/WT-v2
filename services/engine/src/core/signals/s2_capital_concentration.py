"""S2 Capital Concentration strategy."""

from typing import Any
import pandas as pd

from .base import IStrategy, StrategySignal, SignalDirection


class Strategy(IStrategy):
    name = "s2_capital_concentration"
    version = "1.0.0"
    description = "Taker buy/sell ratio pressure"
    required_data = ["taker_ratio"]
    min_candles = 20

    def populate_indicators(self, df: pd.DataFrame, context: dict[str, Any]) -> pd.DataFrame:
        return df

    def generate_signal(self, df: pd.DataFrame, context: dict[str, Any]) -> StrategySignal:
        ratio = float(context.get("taker_ratio", 1.0))
        raw = max(-1.0, min(1.0, (ratio - 1.0) / 0.2))
        direction = SignalDirection.LONG if raw > 0.05 else SignalDirection.SHORT if raw < -0.05 else SignalDirection.NEUTRAL
        return StrategySignal(direction=direction, strength=abs(raw), confidence=min(1.0, abs(raw) * 0.85), metadata={"taker_ratio": ratio})
