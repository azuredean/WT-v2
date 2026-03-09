"""S7 Stop Hunt strategy."""

from typing import Any
import pandas as pd

from .base import IStrategy, StrategySignal, SignalDirection


class Strategy(IStrategy):
    name = "s7_stop_hunt"
    version = "1.0.0"
    description = "Wick + volume spike reversal signal"
    required_data = ["candles"]
    min_candles = 20

    def populate_indicators(self, df: pd.DataFrame, context: dict[str, Any]) -> pd.DataFrame:
        body_high = df[["open", "close"]].max(axis=1)
        body_low = df[["open", "close"]].min(axis=1)
        total_range = (df["high"] - df["low"]).replace(0, 1e-9)
        df["upper_wick_ratio"] = (df["high"] - body_high) / total_range
        df["lower_wick_ratio"] = (body_low - df["low"]) / total_range
        return df

    def generate_signal(self, df: pd.DataFrame, context: dict[str, Any]) -> StrategySignal:
        if len(df) < 3:
            return StrategySignal(direction=SignalDirection.NEUTRAL, strength=0, confidence=0)

        avg_vol = float(df["volume"].tail(20).mean())
        curr = df.iloc[-2]
        nxt = df.iloc[-1]
        vol_spike = float(curr["volume"]) / max(avg_vol, 1e-9)

        raw = 0.0
        if float(curr["lower_wick_ratio"]) > 0.6 and vol_spike > 2 and float(nxt["close"]) > float(curr["open"]):
            raw = min(1.0, float(curr["lower_wick_ratio"]) * vol_spike * 0.25)
        elif float(curr["upper_wick_ratio"]) > 0.6 and vol_spike > 2 and float(nxt["close"]) < float(curr["open"]):
            raw = -min(1.0, float(curr["upper_wick_ratio"]) * vol_spike * 0.25)

        direction = SignalDirection.LONG if raw > 0.05 else SignalDirection.SHORT if raw < -0.05 else SignalDirection.NEUTRAL
        return StrategySignal(direction=direction, strength=abs(raw), confidence=min(1.0, abs(raw) * 0.9), metadata={"vol_spike": vol_spike})
