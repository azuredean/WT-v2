"""S8 Smart Money Edge strategy."""

from typing import Any
import pandas as pd

from .base import IStrategy, StrategySignal, SignalDirection


class Strategy(IStrategy):
    name = "s8_smart_money_edge"
    version = "1.0.0"
    description = "Smart money edge from SME index"
    required_data = ["sme"]
    min_candles = 10

    def populate_indicators(self, df: pd.DataFrame, context: dict[str, Any]) -> pd.DataFrame:
        return df

    def generate_signal(self, df: pd.DataFrame, context: dict[str, Any]) -> StrategySignal:
        sme = float(context.get("sme", 1.0))
        raw = 0.0
        if sme > 1.5:
            raw = min(1.0, (sme - 1.0) / 0.7)
        elif sme < 0.7:
            raw = -min(1.0, (1.0 - sme) / 0.7)
        direction = SignalDirection.LONG if raw > 0.05 else SignalDirection.SHORT if raw < -0.05 else SignalDirection.NEUTRAL
        return StrategySignal(direction=direction, strength=abs(raw), confidence=min(1.0, abs(raw) * 0.85), metadata={"sme": sme})
