"""Circuit breaker — halts trading during extreme conditions.

Based on V2 Supplement Document Section 5.4.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass
class CircuitBreakerState:
    active: bool
    reason: str | None
    activated_at: datetime | None
    expires_at: datetime | None


class CircuitBreaker:
    """Circuit breaker for extreme market conditions."""

    def __init__(
        self,
        market_drop_threshold: float = 0.15,
        multi_exchange_outage_threshold: int = 2,
        pause_duration_hours: int = 24,
    ):
        self.market_drop_threshold = market_drop_threshold
        self.multi_exchange_outage_threshold = multi_exchange_outage_threshold
        self.pause_duration = timedelta(hours=pause_duration_hours)
        self._state = CircuitBreakerState(False, None, None, None)

    @property
    def is_active(self) -> bool:
        if self._state.active and self._state.expires_at:
            if datetime.utcnow() > self._state.expires_at:
                self.reset()
                return False
        return self._state.active

    @property
    def state(self) -> CircuitBreakerState:
        return self._state

    def check_market_drop(self, change_24h: float) -> bool:
        """Check if 24h market drop exceeds threshold."""
        if change_24h < -self.market_drop_threshold:
            self._activate(f"Market dropped {change_24h:.1%} in 24h")
            return True
        return False

    def check_exchange_outage(self, active_exchanges: int, total_exchanges: int) -> bool:
        """Check if too many exchanges are offline."""
        offline = total_exchanges - active_exchanges
        if offline >= self.multi_exchange_outage_threshold:
            self._activate(f"{offline}/{total_exchanges} exchanges offline")
            return True
        return False

    def _activate(self, reason: str) -> None:
        now = datetime.utcnow()
        self._state = CircuitBreakerState(
            active=True,
            reason=reason,
            activated_at=now,
            expires_at=now + self.pause_duration,
        )
        print(f"[CircuitBreaker] ACTIVATED: {reason}")

    def reset(self) -> None:
        self._state = CircuitBreakerState(False, None, None, None)
        print("[CircuitBreaker] Reset")
