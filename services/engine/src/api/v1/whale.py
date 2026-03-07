"""Whale tracker API endpoints."""

from fastapi import APIRouter, Query

router = APIRouter()


@router.get("/profiles")
async def get_participant_profiles(symbol: str = Query(default="BTC/USDT")):
    """Get current participant profile distribution."""
    # TODO: Phase 2 - Get from participant classifier
    return {"symbol": symbol, "profiles": []}


@router.get("/activity")
async def get_whale_activity(
    symbol: str = Query(default="BTC/USDT"),
    limit: int = Query(default=50, le=200),
):
    """Get recent whale activity feed."""
    return {"symbol": symbol, "activities": []}


@router.get("/sme")
async def get_smart_money_edge(symbol: str = Query(default="BTC/USDT")):
    """Get Smart Money Edge (SME) index."""
    return {
        "symbol": symbol,
        "sme": 0.0,
        "smart_pnl": 0.0,
        "dumb_pnl": 0.0,
        "retail_pnl": 0.0,
    }


@router.get("/liquidation-clusters")
async def get_liquidation_clusters(symbol: str = Query(default="BTC/USDT")):
    """Get liquidation price clusters."""
    return {"symbol": symbol, "long_clusters": [], "short_clusters": []}
