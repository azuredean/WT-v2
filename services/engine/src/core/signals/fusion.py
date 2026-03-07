"""Signal fusion engine — combines outputs from all strategies."""

from dataclasses import dataclass, field
from typing import Any

import pandas as pd

from .base import IStrategy, StrategySignal, SignalDirection
from .registry import StrategyRegistry


@dataclass
class FusedSignalResult:
    """Result of signal fusion across all strategies."""

    direction: SignalDirection
    strength: float  # -1.0 to 1.0
    confidence: float  # 0.0 to 1.0
    recommended_size: float  # position size as % of portfolio
    data_quality_score: float
    contributing: list[dict[str, Any]] = field(default_factory=list)
    anomaly_flags: list[str] = field(default_factory=list)


class SignalFusion:
    """Weighted signal fusion engine.

    Collects signals from all registered strategies, applies weighted scoring
    with conflict resolution, and produces a final fused signal.
    """

    # Default weights for built-in strategies
    DEFAULT_WEIGHTS = {
        "s1_whale_tracking": 0.20,
        "s2_capital_concentration": 0.12,
        "s3_funding_reversal": 0.10,
        "s4_liquidity_grab": 0.10,
        "s5_oi_divergence": 0.10,
        "s6_retail_counter": 0.13,
        "s7_stop_hunt": 0.10,
        "s8_smart_money_edge": 0.15,
    }

    def __init__(
        self,
        registry: StrategyRegistry,
        weights: dict[str, float] | None = None,
    ):
        self.registry = registry
        self.weights = weights or self.DEFAULT_WEIGHTS

    def compute(
        self,
        df: pd.DataFrame,
        context: dict[str, Any],
    ) -> FusedSignalResult:
        """Run all strategies and produce a fused signal.

        Args:
            df: OHLCV DataFrame
            context: Additional market data (funding, OI, orderbook, whale data)

        Returns:
            FusedSignalResult with direction, strength, confidence, and size
        """
        signals: list[tuple[str, StrategySignal, float, float]] = []

        for strategy in self.registry.get_all():
            try:
                # Validate data quality for this strategy
                dqs = strategy.validate_data(df, context)

                if dqs < 0.3:
                    # Skip strategy if data quality is too low
                    continue

                # Run strategy
                enriched_df = strategy.populate_indicators(df.copy(), context)
                signal = strategy.generate_signal(enriched_df, context)
                weight = self.weights.get(strategy.name, 0.1)

                signals.append((strategy.name, signal, weight, dqs))
            except Exception as e:
                print(f"[Fusion] Strategy {strategy.name} failed: {e}")

        if not signals:
            return FusedSignalResult(
                direction=SignalDirection.NEUTRAL,
                strength=0.0,
                confidence=0.0,
                recommended_size=0.0,
                data_quality_score=0.0,
            )

        return self._fuse(signals)

    def _fuse(
        self,
        signals: list[tuple[str, StrategySignal, float, float]],
    ) -> FusedSignalResult:
        """Fuse individual strategy signals into a combined result."""
        total_weight = sum(w for _, _, w, _ in signals)
        if total_weight == 0:
            total_weight = 1.0

        # Weighted strength calculation
        weighted_strength = 0.0
        weighted_confidence = 0.0
        avg_dqs = 0.0
        contributing = []

        for name, signal, weight, dqs in signals:
            # Convert direction to signed strength
            signed_strength = signal.strength
            if signal.direction == SignalDirection.SHORT:
                signed_strength = -abs(signed_strength)
            elif signal.direction == SignalDirection.LONG:
                signed_strength = abs(signed_strength)

            normalized_weight = weight / total_weight
            weighted_strength += signed_strength * normalized_weight
            weighted_confidence += signal.confidence * normalized_weight
            avg_dqs += dqs * normalized_weight

            contributing.append({
                "strategy_id": name,
                "direction": signal.direction.value,
                "strength": signal.strength,
                "confidence": signal.confidence,
                "weight": weight,
                "data_quality": dqs,
            })

        # Determine final direction
        if weighted_strength > 0.1:
            direction = SignalDirection.LONG
        elif weighted_strength < -0.1:
            direction = SignalDirection.SHORT
        else:
            direction = SignalDirection.NEUTRAL

        # Calculate recommended position size (Half-Kelly)
        abs_strength = abs(weighted_strength)
        recommended_size = self._half_kelly(abs_strength, weighted_confidence, avg_dqs)

        return FusedSignalResult(
            direction=direction,
            strength=weighted_strength,
            confidence=weighted_confidence,
            recommended_size=recommended_size,
            data_quality_score=avg_dqs,
            contributing=contributing,
        )

    def _half_kelly(self, strength: float, confidence: float, dqs: float) -> float:
        """Calculate position size using Half-Kelly criterion with DQS adjustment.

        Returns position size as % of portfolio (0-10%).
        """
        if strength < 0.1 or confidence < 0.3:
            return 0.0

        # Kelly fraction: edge / odds
        edge = strength * confidence
        kelly = edge / 1.0  # Simplified: assuming 1:1 risk/reward

        # Half-Kelly for safety
        half_kelly = kelly / 2.0

        # Adjust by data quality
        adjusted = half_kelly * dqs

        # Cap at 10%
        return min(round(adjusted * 100, 1), 10.0)
