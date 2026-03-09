"""Whale tracker API endpoints."""

from fastapi import APIRouter, Query

from ...core.participant.classifier import ParticipantFeatures, classify_participant

router = APIRouter()


@router.get("/profiles")
async def get_participant_profiles(symbol: str = Query(default="BTC/USDT")):
    """Get current participant profile distribution."""
    samples = [
        ParticipantFeatures(2_500_000, 0.62, 36, 4.0, 0.52, 0.7, 8, 0.4),
        ParticipantFeatures(1_800_000, 0.39, 10, 12.0, 0.1, 0.2, 12, 0.3),
        ParticipantFeatures(6_000, 0.45, 2, 18.0, 0.2, 0.2, 30, 0.2),
        ParticipantFeatures(120_000, 0.51, 0.2, 2.0, 0.3, 0.4, 60, 0.9),
    ]
    buckets: dict[str, dict] = {}
    for f in samples:
        ptype, conf = classify_participant(f)
        key = ptype.value
        if key not in buckets:
            buckets[key] = {"type": key, "count": 0, "avg_confidence": 0.0}
        buckets[key]["count"] += 1
        buckets[key]["avg_confidence"] += conf

    profiles = []
    for v in buckets.values():
        v["avg_confidence"] = round(v["avg_confidence"] / max(v["count"], 1), 4)
        profiles.append(v)

    return {"symbol": symbol, "profiles": profiles}


@router.get("/activity")
async def get_whale_activity(
    symbol: str = Query(default="BTC/USDT"),
    limit: int = Query(default=50, le=200),
):
    """Get recent whale activity feed."""
    return {
        "symbol": symbol,
        "activities": [
            {
                "id": "sim_1",
                "exchange": "binance",
                "symbol": symbol,
                "participant_type": "smart_whale",
                "side": "buy",
                "size": 1_250_000,
                "price": 0,
                "timestamp": 0,
            }
        ][:limit],
    }


@router.get("/sme")
async def get_smart_money_edge(symbol: str = Query(default="BTC/USDT")):
    """Get Smart Money Edge (SME) index."""
    smart_pnl = 12_000_000.0
    dumb_pnl = -8_000_000.0
    retail_pnl = -4_500_000.0
    denom = abs(dumb_pnl + retail_pnl)
    sme = smart_pnl / denom if denom > 0 else 1.0
    return {"symbol": symbol, "sme": round(sme, 4), "smart_pnl": smart_pnl, "dumb_pnl": dumb_pnl, "retail_pnl": retail_pnl}


@router.get("/liquidation-clusters")
async def get_liquidation_clusters(symbol: str = Query(default="BTC/USDT")):
    """Get liquidation price clusters."""
    return {"symbol": symbol, "long_clusters": [], "short_clusters": []}
