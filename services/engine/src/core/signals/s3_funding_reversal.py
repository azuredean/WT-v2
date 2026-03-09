"""S3 Funding Reversal strategy."""

from typing import Any
import pandas as pd

from .base import IStrategy, StrategySignal, SignalDirection


class Strategy(IStrategy):
    name = "s3_funding_reversal"
    version = "1.0.0"
    description = "Extreme funding mean-reversion"
    required_data = ["funding_rate"]
    min_candles = 10

    def populate_indicators(self, df: pd.DataFrame, context: dict[str, Any]) -> pd.DataFrame:
        return df

    def generate_signal(self, df: pd.DataFrame, context: dict[str, Any]) -> StrategySignal:
        funding = float(context.get("funding_rate", 0.0))
        raw = 0.0
        if abs(funding) > 0.0003:
            raw = max(-1.0, min(1.0, -funding / 0.001))
        direction = SignalDirection.LONG if raw > 0.05 else SignalDirection.SHORT if raw < -0.05 else SignalDirection.NEUTRAL
        return StrategySignal(direction=direction, strength=abs(raw), confidence=min(1.0, abs(raw) * 0.8), metadata={"funding_rate": funding})
