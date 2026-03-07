"""Backtesting API endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class BacktestConfig(BaseModel):
    strategy_ids: list[str]
    symbol: str = "BTC/USDT"
    timeframe: str = "1h"
    start_date: str
    end_date: str
    initial_capital: float = 10000.0


@router.post("/run")
async def run_backtest(config: BacktestConfig):
    """Start a backtest run (async job)."""
    # TODO: Phase 5 - Submit to Redis Streams job queue
    return {"job_id": "placeholder", "status": "not_implemented"}


@router.get("/{job_id}/results")
async def get_backtest_results(job_id: str):
    """Get results of a completed backtest."""
    return {
        "job_id": job_id,
        "status": "not_found",
        "results": None,
    }
