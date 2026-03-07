"""Data Quality Score calculator.

Based on V2 Supplement Document Section 6.2.
"""

from dataclasses import dataclass
from enum import Enum


class TradingAction(Enum):
    FULL_CONFIDENCE = "full_confidence"
    REDUCE_POSITION = "reduce_position"
    PAUSE_TRADING = "pause_trading"


@dataclass
class DataQualityScore:
    score: float  # 0-1
    action: TradingAction
    components: dict[str, float]


def calculate_data_quality(
    active_sources: int,
    total_sources: int,
    max_data_delay_seconds: float,
    cross_validation_score: float,
    anomaly_ratio: float,
) -> DataQualityScore:
    """Calculate data quality score to determine trading confidence.

    Components:
    - Source coverage: What fraction of data sources are active
    - Data freshness: How recent is the data
    - Cross-validation: Do different sources agree
    - Anomaly-free ratio: What fraction of recent data is clean

    Returns DQS and recommended trading action.
    """
    components = {
        "source_coverage": active_sources / max(total_sources, 1),
        "data_freshness": max(0.0, 1.0 - max_data_delay_seconds / 60),
        "cross_validation": cross_validation_score,
        "anomaly_free": max(0.0, 1.0 - anomaly_ratio),
    }

    # Weighted average
    weights = {
        "source_coverage": 0.25,
        "data_freshness": 0.25,
        "cross_validation": 0.30,
        "anomaly_free": 0.20,
    }

    score = sum(components[k] * weights[k] for k in components)

    # Determine action
    if score < 0.7:
        action = TradingAction.PAUSE_TRADING
    elif score < 0.85:
        action = TradingAction.REDUCE_POSITION
    else:
        action = TradingAction.FULL_CONFIDENCE

    return DataQualityScore(score=round(score, 3), action=action, components=components)
