"""Signal fusion API endpoints."""

from fastapi import APIRouter, Query

router = APIRouter()


@router.get("/current")
async def get_current_signal(symbol: str = Query(default="BTC/USDT")):
    """Get current fused trading signal for a symbol."""
    # TODO: Phase 3 - Get from signal fusion engine
    return {
        "symbol": symbol,
        "direction": "neutral",
        "strength": 0.0,
        "confidence": 0.0,
        "recommended_size": 0.0,
        "data_quality_score": 0.0,
        "strategies": [],
        "timestamp": 0,
    }


@router.get("/strategies")
async def list_strategies():
    """List all registered strategies with their status."""
    # TODO: Phase 3 - Get from strategy registry
    return {"strategies": []}


@router.get("/history")
async def get_signal_history(
    symbol: str = Query(default="BTC/USDT"),
    strategy_id: str | None = None,
    limit: int = Query(default=100, le=1000),
):
    """Get historical signals."""
    return {"data": []}
