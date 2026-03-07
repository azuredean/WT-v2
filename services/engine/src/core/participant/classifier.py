"""Market participant classifier — classifies entities into 5 types.

Based on V2 Supplement Document Section 2.2.
"""

from dataclasses import dataclass
from enum import Enum


class ParticipantType(Enum):
    SMART_WHALE = "smart_whale"
    DUMB_WHALE = "dumb_whale"
    MARKET_MAKER = "market_maker"
    RETAIL_HERD = "retail_herd"
    ARBITRAGEUR = "arbitrageur"


@dataclass
class ParticipantFeatures:
    """Multi-dimensional features for participant classification."""

    avg_position_size: float  # USD
    win_rate: float  # 90-day rolling win rate (0-1)
    avg_holding_time: float  # hours
    leverage_avg: float
    counter_trend_ratio: float  # fraction of trades against trend (0-1)
    entry_timing_score: float  # 0-1, higher = enters after liquidation cascades
    position_turnover: float  # trades per day
    bid_ask_symmetry: float  # 0-1, higher = more symmetric (market maker signal)


def classify_participant(features: ParticipantFeatures) -> tuple[ParticipantType, float]:
    """Classify a market participant based on multi-dimensional features.

    Returns (ParticipantType, confidence).
    Based on V2 document Section 2.2.2.
    """
    confidence = 0.5

    # Large position = whale category
    if features.avg_position_size > 1_000_000:
        if features.win_rate > 0.55 and features.counter_trend_ratio > 0.4:
            confidence = min(0.5 + features.win_rate * 0.3 + features.counter_trend_ratio * 0.2, 0.95)
            return ParticipantType.SMART_WHALE, confidence
        elif features.win_rate < 0.45:
            confidence = min(0.5 + (1 - features.win_rate) * 0.3, 0.9)
            return ParticipantType.DUMB_WHALE, confidence
        else:
            # Borderline whale — classify based on other signals
            if features.entry_timing_score > 0.6:
                return ParticipantType.SMART_WHALE, 0.6
            else:
                return ParticipantType.DUMB_WHALE, 0.55

    # Market maker detection
    if features.bid_ask_symmetry > 0.8 and features.position_turnover > 50:
        confidence = min(0.6 + features.bid_ask_symmetry * 0.2 + min(features.position_turnover / 200, 0.2), 0.95)
        return ParticipantType.MARKET_MAKER, confidence

    # High leverage + small size = retail
    if features.leverage_avg > 10 and features.avg_position_size < 10_000:
        confidence = min(0.6 + (features.leverage_avg / 50) * 0.2, 0.9)
        return ParticipantType.RETAIL_HERD, confidence

    # Default: arbitrageur / other
    if features.avg_holding_time < 0.5 and features.position_turnover > 20:
        return ParticipantType.ARBITRAGEUR, 0.7

    # Fallback based on position size
    if features.avg_position_size < 10_000:
        return ParticipantType.RETAIL_HERD, 0.5
    else:
        return ParticipantType.ARBITRAGEUR, 0.4
