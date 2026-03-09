"""Signal fusion API endpoints."""

import time

import pandas as pd
from fastapi import APIRouter, Query

from ...core import runtime
from ...core.signals.fusion import SignalFusion
from ...core.signals.registry import StrategyRegistry

router = APIRouter()


def _build_context(symbol: str, candles_df: pd.DataFrame) -> dict:
    # lightweight context bootstrap; can be enriched later with external providers
    close_first = float(candles_df.iloc[0]["close"]) if len(candles_df) else 0.0
    close_last = float(candles_df.iloc[-1]["close"]) if len(candles_df) else 0.0
    price_change = (close_last - close_first) / close_first if close_first else 0.0
    return {
        "symbol": symbol,
        "top_ls_ratio": 1.0,
        "retail_ls_ratio": 1.0,
        "taker_ratio": 1.0,
        "funding_rate": 0.0,
        "oi_change": 0.0,
        "sme": 1.0,
        "price_change": price_change,
    }


@router.get("/current")
async def get_current_signal(symbol: str = Query(default="BTC/USDT")):
    """Get current fused trading signal for a symbol."""
    if runtime.aggregator is None:
        return {
            "symbol": symbol,
            "direction": "neutral",
            "strength": 0.0,
            "confidence": 0.0,
            "recommended_size": 0.0,
            "data_quality_score": 0.0,
            "strategies": [],
            "timestamp": int(time.time() * 1000),
        }

    candles = await runtime.aggregator.fetch_candles(symbol, "5m", limit=120)
    if len(candles) < 20:
        return {
            "symbol": symbol,
            "direction": "neutral",
            "strength": 0.0,
            "confidence": 0.0,
            "recommended_size": 0.0,
            "data_quality_score": 0.0,
            "strategies": [],
            "timestamp": int(time.time() * 1000),
        }

    df = pd.DataFrame(
        [
            {
                "time": c.time,
                "open": c.open,
                "high": c.high,
                "low": c.low,
                "close": c.close,
                "volume": c.volume,
            }
            for c in candles
        ]
    )

    registry = StrategyRegistry()
    registry.discover_builtins()
    fusion = SignalFusion(registry)
    context = _build_context(symbol, df)
    result = fusion.compute(df, context)

    return {
        "symbol": symbol,
        "direction": result.direction.value,
        "strength": round(result.strength, 4),
        "confidence": round(result.confidence, 4),
        "recommended_size": result.recommended_size,
        "data_quality_score": round(result.data_quality_score, 4),
        "strategies": result.contributing,
        "timestamp": int(time.time() * 1000),
    }


@router.get("/strategies")
async def list_strategies():
    """List all registered strategies with their status."""
    registry = StrategyRegistry()
    registry.discover_builtins()
    return {"strategies": registry.to_dict()}


@router.get("/history")
async def get_signal_history(
    symbol: str = Query(default="BTC/USDT"),
    strategy_id: str | None = None,
    limit: int = Query(default=100, le=1000),
):
    """Get historical signals."""
    # Local fallback: no persistence yet, return empty structure
    return {"symbol": symbol, "strategy_id": strategy_id, "data": [], "limit": limit}
