"""3-layer anomaly detection system.

Based on V2 Supplement Document Section 5.2.
"""

from dataclasses import dataclass
from enum import Enum

import numpy as np


class AnomalyType(Enum):
    FLASH_CRASH = "flash_crash"
    VOLUME_SPIKE = "volume_spike"
    SPOOFING = "spoofing"
    WASH_TRADING = "wash_trading"
    DATA_GAP = "data_gap"
    EXCHANGE_OUTAGE = "exchange_outage"


class AnomalySeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class AnomalyResult:
    detected: bool
    anomaly_type: AnomalyType | None
    severity: AnomalySeverity
    description: str
    affected_data_points: int


class AnomalyDetector:
    """Multi-layer anomaly detection system."""

    def __init__(
        self,
        z_score_threshold: float = 3.0,
        iqr_multiplier: float = 3.0,
        min_consensus: int = 2,
    ):
        self.z_score_threshold = z_score_threshold
        self.iqr_multiplier = iqr_multiplier
        self.min_consensus = min_consensus

    def detect_price_anomaly(self, prices: list[float], window: int = 100) -> list[bool]:
        """Layer 2: Statistical anomaly detection with multi-method consensus.

        Uses Z-Score + IQR + Rolling window. Marks as anomaly if >= min_consensus agree.
        """
        arr = np.array(prices)
        n = len(arr)
        anomalies = np.zeros(n, dtype=bool)

        if n < window:
            return anomalies.tolist()

        # Method 1: Z-Score
        mean = np.mean(arr[-window:])
        std = np.std(arr[-window:])
        if std > 0:
            z_scores = np.abs((arr - mean) / std)
            z_anomalies = z_scores > self.z_score_threshold
        else:
            z_anomalies = np.zeros(n, dtype=bool)

        # Method 2: IQR
        q1, q3 = np.percentile(arr[-window:], [25, 75])
        iqr = q3 - q1
        iqr_lower = q1 - self.iqr_multiplier * iqr
        iqr_upper = q3 + self.iqr_multiplier * iqr
        iqr_anomalies = (arr < iqr_lower) | (arr > iqr_upper)

        # Method 3: Rolling window
        rolling_anomalies = np.zeros(n, dtype=bool)
        for i in range(window, n):
            local_mean = np.mean(arr[i - window : i])
            local_std = np.std(arr[i - window : i])
            if local_std > 0:
                deviation = abs(arr[i] - local_mean) / local_std
                rolling_anomalies[i] = deviation > 3.5

        # Consensus: at least min_consensus methods agree
        consensus = (
            z_anomalies.astype(int)
            + iqr_anomalies.astype(int)
            + rolling_anomalies.astype(int)
        )
        anomalies = consensus >= self.min_consensus

        return anomalies.tolist()

    def detect_flash_crash(
        self, price_now: float, price_1min_ago: float, threshold: float = 0.05
    ) -> AnomalyResult:
        """Layer 1: Flash crash detection — price moves >5% in 1 minute."""
        change = abs(price_now - price_1min_ago) / max(price_1min_ago, 0.01)

        if change > threshold:
            return AnomalyResult(
                detected=True,
                anomaly_type=AnomalyType.FLASH_CRASH,
                severity=AnomalySeverity.CRITICAL,
                description=f"Flash crash detected: {change:.1%} move in 1 minute",
                affected_data_points=1,
            )

        return AnomalyResult(False, None, AnomalySeverity.LOW, "", 0)

    def detect_volume_anomaly(
        self, current_volume: float, avg_volume: float, threshold: float = 10.0
    ) -> AnomalyResult:
        """Volume spike detection — volume > 10x average."""
        if avg_volume == 0:
            return AnomalyResult(False, None, AnomalySeverity.LOW, "", 0)

        ratio = current_volume / avg_volume
        if ratio > threshold:
            return AnomalyResult(
                detected=True,
                anomaly_type=AnomalyType.VOLUME_SPIKE,
                severity=AnomalySeverity.HIGH,
                description=f"Volume spike: {ratio:.1f}x average",
                affected_data_points=1,
            )

        return AnomalyResult(False, None, AnomalySeverity.LOW, "", 0)
