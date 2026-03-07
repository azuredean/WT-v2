"""Liquidation fuel analysis — identifies who's losing money.

Based on V2 Supplement Document Section 3.1.1.
"""

from dataclasses import dataclass
from enum import Enum


class LiquidationSignal(Enum):
    STRONG_ENTRY = "strong_entry"  # Smart money accumulating after cascade
    WEAK_ENTRY = "weak_entry"
    NO_SIGNAL = "no_signal"


@dataclass
class LiquidationEvent:
    timestamp: int
    exchange: str
    symbol: str
    side: str  # 'LONG' or 'SHORT'
    amount: float  # USD
    price: float


@dataclass
class LiquidationAnalysis:
    long_liquidated: float  # total USD
    short_liquidated: float
    ratio: float  # long/short
    cascade_detected: bool
    signal: LiquidationSignal
    clusters: list[dict]  # price level clusters


def analyze_liquidation_fuel(
    liquidations: list[LiquidationEvent],
    current_price: float,
    price_stabilized: bool = False,
) -> LiquidationAnalysis:
    """Analyze liquidation events to identify 'who is losing money'.

    Key logic:
    - Cascade liquidation followed by price stabilization = entry opportunity
    - Smart money enters after retail gets liquidated
    """
    if not liquidations:
        return LiquidationAnalysis(0, 0, 1.0, False, LiquidationSignal.NO_SIGNAL, [])

    long_liq = sum(e.amount for e in liquidations if e.side == "LONG")
    short_liq = sum(e.amount for e in liquidations if e.side == "SHORT")
    ratio = long_liq / max(short_liq, 1)

    # Detect cascade: multiple liquidations within 5 minutes
    cascade = _detect_cascade(liquidations, threshold_ms=300_000)

    # Cluster liquidations by price level
    clusters = _cluster_by_price(liquidations)

    signal = LiquidationSignal.NO_SIGNAL
    if cascade and price_stabilized:
        signal = LiquidationSignal.STRONG_ENTRY
    elif cascade:
        signal = LiquidationSignal.WEAK_ENTRY

    return LiquidationAnalysis(
        long_liquidated=long_liq,
        short_liquidated=short_liq,
        ratio=ratio,
        cascade_detected=cascade,
        signal=signal,
        clusters=clusters,
    )


def _detect_cascade(events: list[LiquidationEvent], threshold_ms: int = 300_000) -> bool:
    """Detect cascade: 5+ liquidations within threshold window."""
    if len(events) < 5:
        return False

    sorted_events = sorted(events, key=lambda e: e.timestamp)
    for i in range(len(sorted_events) - 4):
        window = sorted_events[i : i + 5]
        if window[-1].timestamp - window[0].timestamp < threshold_ms:
            total_value = sum(e.amount for e in window)
            if total_value > 1_000_000:  # >$1M in cascade
                return True
    return False


def _cluster_by_price(events: list[LiquidationEvent], tolerance: float = 0.002) -> list[dict]:
    """Cluster liquidation events by price level (within 0.2% tolerance)."""
    if not events:
        return []

    clusters: list[dict] = []
    sorted_events = sorted(events, key=lambda e: e.price)

    current_cluster = {
        "price": sorted_events[0].price,
        "total_amount": sorted_events[0].amount,
        "count": 1,
        "side": sorted_events[0].side,
    }

    for event in sorted_events[1:]:
        if abs(event.price - current_cluster["price"]) / current_cluster["price"] < tolerance:
            current_cluster["total_amount"] += event.amount
            current_cluster["count"] += 1
        else:
            clusters.append(current_cluster)
            current_cluster = {
                "price": event.price,
                "total_amount": event.amount,
                "count": 1,
                "side": event.side,
            }

    clusters.append(current_cluster)
    return sorted(clusters, key=lambda c: c["total_amount"], reverse=True)[:10]
