"""S1 Whale Tracking strategy."""

from typing import Any
import pandas as pd

from .base import IStrategy, StrategySignal, SignalDirection


class Strategy(IStrategy):
    name = "s1_whale_tracking"
    version = "1.0.0"
    description = "Top trader vs retail long/short divergence"
    required_data = ["top_ls_ratio", "retail_ls_ratio"]
    min_candles = 20

    def populate_indicators(self, df: pd.DataFrame, context: dict[str, Any]) -> pd.DataFrame:
        return df

    def generate_signal(self, df: pd.DataFrame, context: dict[str, Any]) -> StrategySignal:
        top = float(context.get("top_ls_ratio", 1.0))
        retail = float(context.get("retail_ls_ratio", 1.0))
        diff = top - retail
        strength = max(-1.0, min(1.0, diff / 0.3))
        direction = SignalDirection.LONG if strength > 0.05 else SignalDirection.SHORT if strength < -0.05 else SignalDirection.NEUTRAL
        confidence = min(1.0, abs(strength) * 0.8)
        return StrategySignal(direction=direction, strength=abs(strength), confidence=confidence, metadata={"top": top, "retail": retail, "diff": diff})
