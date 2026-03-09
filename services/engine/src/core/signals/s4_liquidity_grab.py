"""S4 Liquidity Grab strategy."""

from typing import Any
import pandas as pd

from .base import IStrategy, StrategySignal, SignalDirection


class Strategy(IStrategy):
    name = "s4_liquidity_grab"
    version = "1.0.0"
    description = "Volume spike + stabilization after liquidation"
    required_data = ["candles"]
    min_candles = 30

    def populate_indicators(self, df: pd.DataFrame, context: dict[str, Any]) -> pd.DataFrame:
        df["range"] = (df["high"] - df["low"]).abs()
        return df

    def generate_signal(self, df: pd.DataFrame, context: dict[str, Any]) -> StrategySignal:
        if len(df) < 20:
            return StrategySignal(direction=SignalDirection.NEUTRAL, strength=0, confidence=0)
        avg_vol = float(df["volume"].tail(20).mean())
        last = df.iloc[-1]
        raw = 0.0
        if avg_vol > 0 and float(last["volume"]) > avg_vol * 2:
            raw = 0.6 if float(last["close"]) < float(last["open"]) else -0.6
        direction = SignalDirection.LONG if raw > 0.05 else SignalDirection.SHORT if raw < -0.05 else SignalDirection.NEUTRAL
        return StrategySignal(direction=direction, strength=abs(raw), confidence=min(1.0, abs(raw) * 0.8), metadata={"avg_vol": avg_vol})
