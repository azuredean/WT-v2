"""Anomaly detection API endpoints."""

from fastapi import APIRouter, Query

router = APIRouter()


@router.get("/status")
async def get_anomaly_status(symbol: str = Query(default="BTC/USDT")):
    """Get current anomaly detection status and circuit breaker state."""
    return {
        "symbol": symbol,
        "circuit_breaker": {
            "active": False,
            "reason": None,
            "activated_at": None,
            "expires_at": None,
        },
        "data_quality_score": 0.0,
        "anomalies_detected": [],
        "active_sources": 0,
        "total_sources": 5,
    }


@router.get("/history")
async def get_anomaly_history(
    symbol: str = Query(default="BTC/USDT"),
    limit: int = Query(default=50, le=200),
):
    """Get recent anomaly detection history."""
    return {"data": []}
