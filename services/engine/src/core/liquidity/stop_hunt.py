"""Stop hunt detection — detects smart money stop loss hunting patterns.

Based on V2 Supplement Document Section 3.1.2.
"""

from dataclasses import dataclass


@dataclass
class StopHuntSignal:
    detected: bool
    price: float
    direction: str  # 'BULLISH' or 'BEARISH'
    confidence: float
    wick_ratio: float
    volume_spike: float


@dataclass
class CandleData:
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float

    @property
    def total_range(self) -> float:
        return self.high - self.low if self.high > self.low else 0.001

    @property
    def body_size(self) -> float:
        return abs(self.close - self.open)

    @property
    def lower_wick(self) -> float:
        return min(self.open, self.close) - self.low

    @property
    def upper_wick(self) -> float:
        return self.high - max(self.open, self.close)


def detect_stop_hunt(
    candles: list[CandleData],
    key_levels: list[float],
    avg_volume: float,
) -> StopHuntSignal | None:
    """Detect stop hunt pattern.

    Pattern:
    1. Price quickly penetrates key level (previous high/low/round number)
    2. Forms long wick at/below key level
    3. Volume spikes during penetration
    4. Quick recovery within 1-3 candles
    """
    if len(candles) < 3:
        return None

    current = candles[-1]
    prev = candles[-2]

    # Check bearish stop hunt (hunts longs, then reverses up)
    for level in key_levels:
        # Did price penetrate below key level?
        if current.low < level < prev.low:
            wick_ratio = current.lower_wick / current.total_range
            volume_spike = current.volume / max(avg_volume, 1)
            quick_recovery = current.close > level

            if wick_ratio > 0.6 and volume_spike > 2 and quick_recovery:
                confidence = min(
                    0.3 + wick_ratio * 0.3 + min(volume_spike / 10, 0.2) + (0.2 if quick_recovery else 0),
                    0.95,
                )
                return StopHuntSignal(
                    detected=True,
                    price=current.low,
                    direction="BULLISH",
                    confidence=confidence,
                    wick_ratio=wick_ratio,
                    volume_spike=volume_spike,
                )

        # Check bullish stop hunt (hunts shorts, then reverses down)
        if current.high > level > prev.high:
            wick_ratio = current.upper_wick / current.total_range
            volume_spike = current.volume / max(avg_volume, 1)
            quick_recovery = current.close < level

            if wick_ratio > 0.6 and volume_spike > 2 and quick_recovery:
                confidence = min(
                    0.3 + wick_ratio * 0.3 + min(volume_spike / 10, 0.2) + (0.2 if quick_recovery else 0),
                    0.95,
                )
                return StopHuntSignal(
                    detected=True,
                    price=current.high,
                    direction="BEARISH",
                    confidence=confidence,
                    wick_ratio=wick_ratio,
                    volume_spike=volume_spike,
                )

    return None
