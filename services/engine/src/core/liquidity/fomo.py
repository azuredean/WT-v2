"""FOMO crowding detector — detects retail herd crowding.

Based on V2 Supplement Document Section 3.1.3.
"""

from dataclasses import dataclass


@dataclass
class FOMOSignal:
    detected: bool
    score: float  # 0-1
    direction: str  # 'counter_long' or 'counter_short'
    oi_change: float
    funding_rate: float
    retail_ls_ratio: float
    top_ls_ratio: float
    divergence: float


def detect_fomo_crowding(
    oi_change_4h: float,
    funding_rate: float,
    retail_ls_ratio: float,
    top_trader_ls_ratio: float,
) -> FOMOSignal:
    """Detect FOMO crowding pattern.

    FOMO = OI rapidly rising + extreme funding + retail ratio heavily skewed
    + divergence from top traders = counter-trade opportunity
    """
    divergence = abs(retail_ls_ratio - top_trader_ls_ratio)

    score = 0.0

    # OI increased >10% in 4 hours
    if oi_change_4h > 10:
        score += 0.3

    # Extreme funding rate (>0.05%)
    if abs(funding_rate) > 0.05:
        score += 0.3

    # Retail vs top trader divergence
    if divergence > 0.5:
        score += 0.4

    detected = score > 0.7

    # Determine counter-trade direction
    direction = "counter_long" if retail_ls_ratio > 1.5 else "counter_short"

    return FOMOSignal(
        detected=detected,
        score=score,
        direction=direction,
        oi_change=oi_change_4h,
        funding_rate=funding_rate,
        retail_ls_ratio=retail_ls_ratio,
        top_ls_ratio=top_trader_ls_ratio,
        divergence=divergence,
    )
