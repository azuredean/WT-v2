"""S5 OI Divergence strategy."""

from typing import Any
import pandas as pd

from .base import IStrategy, StrategySignal, SignalDirection


class Strategy(IStrategy):
    name = "s5_oi_divergence"
    version = "1.0.0"
    description = "Price and open interest divergence"
    required_data = ["oi_change"]
    min_candles = 20

    def populate_indicators(self, df: pd.DataFrame, context: dict[str, Any]) -> pd.DataFrame:
        return df

    def generate_signal(self, df: pd.DataFrame, context: dict[str, Any]) -> StrategySignal:
        if len(df) < 2:
            return StrategySignal(direction=SignalDirection.NEUTRAL, strength=0, confidence=0)
        price_change = (float(df.iloc[-1]["close"]) - float(df.iloc[0]["close"])) / max(float(df.iloc[0]["close"]), 1e-9)
        oi_change = float(context.get("oi_change", 0.0))
        raw = 0.0
        if price_change > 0.03 and oi_change < -0.05:
            raw = -0.8
        elif price_change < -0.03 and oi_change > 0.05:
            raw = 0.8
        direction = SignalDirection.LONG if raw > 0.05 else SignalDirection.SHORT if raw < -0.05 else SignalDirection.NEUTRAL
        return StrategySignal(direction=direction, strength=abs(raw), confidence=min(1.0, abs(raw) * 0.9), metadata={"price_change": price_change, "oi_change": oi_change})
