"""S6 Retail Counter strategy."""

from typing import Any
import pandas as pd

from .base import IStrategy, StrategySignal, SignalDirection


class Strategy(IStrategy):
    name = "s6_retail_counter"
    version = "1.0.0"
    description = "FOMO crowding detector and counter-trade"
    required_data = ["retail_ls_ratio", "top_ls_ratio", "oi_change", "funding_rate"]
    min_candles = 10

    def populate_indicators(self, df: pd.DataFrame, context: dict[str, Any]) -> pd.DataFrame:
        return df

    def generate_signal(self, df: pd.DataFrame, context: dict[str, Any]) -> StrategySignal:
        retail = float(context.get("retail_ls_ratio", 1.0))
        top = float(context.get("top_ls_ratio", 1.0))
        oi_change = float(context.get("oi_change", 0.0))
        funding = float(context.get("funding_rate", 0.0))
        divergence = abs(retail - top)

        score = 0.0
        if oi_change > 10:
            score += 0.3
        if abs(funding) > 0.0005:
            score += 0.3
        if divergence > 0.5:
            score += 0.4

        raw = 0.0
        if score > 0.7:
            raw = -min(1.0, score) if retail > top else min(1.0, score)

        direction = SignalDirection.LONG if raw > 0.05 else SignalDirection.SHORT if raw < -0.05 else SignalDirection.NEUTRAL
        return StrategySignal(direction=direction, strength=abs(raw), confidence=min(1.0, max(0.3, score)), metadata={"score": score, "retail": retail, "top": top})
