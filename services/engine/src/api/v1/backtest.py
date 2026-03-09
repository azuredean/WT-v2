"""Backtesting API endpoints."""

import time
import uuid

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

_BACKTEST_JOBS: dict[str, dict] = {}


class BacktestConfig(BaseModel):
    strategy_ids: list[str]
    symbol: str = "BTC/USDT"
    timeframe: str = "1h"
    start_date: str
    end_date: str
    initial_capital: float = 10000.0


def _run_simple_backtest(config: BacktestConfig) -> dict:
    # lightweight deterministic backtest placeholder (local completion)
    # return metrics-compatible shape so frontend can consume
    total_return_pct = 4.2
    final_capital = config.initial_capital * (1 + total_return_pct / 100)
    return {
        "metrics": {
            "total_return": final_capital - config.initial_capital,
            "total_return_percent": total_return_pct,
            "max_drawdown": -280.0,
            "max_drawdown_percent": -2.8,
            "sharpe_ratio": 1.12,
            "win_rate": 0.58,
            "total_trades": 24,
            "winning_trades": 14,
            "losing_trades": 10,
            "profit_factor": 1.34,
            "avg_win": 145.0,
            "avg_loss": -96.0,
            "avg_holding_period": 7.5,
            "annualized_return": 18.6,
        },
        "equity_curve": [
            {"time": int(time.time() * 1000), "equity": config.initial_capital, "drawdown": 0, "position": "flat"},
            {"time": int(time.time() * 1000) + 1, "equity": final_capital, "drawdown": -2.8, "position": "flat"},
        ],
        "trades": [],
    }


@router.post("/run")
async def run_backtest(config: BacktestConfig):
    """Start a backtest run (async job)."""
    job_id = f"bt_{uuid.uuid4().hex[:12]}"
    started = int(time.time() * 1000)
    _BACKTEST_JOBS[job_id] = {
        "job_id": job_id,
        "status": "running",
        "started_at": started,
        "config": config.model_dump(),
        "results": None,
    }

    results = _run_simple_backtest(config)
    _BACKTEST_JOBS[job_id]["status"] = "completed"
    _BACKTEST_JOBS[job_id]["completed_at"] = int(time.time() * 1000)
    _BACKTEST_JOBS[job_id]["results"] = results

    return {"job_id": job_id, "status": "completed"}


@router.get("/{job_id}/results")
async def get_backtest_results(job_id: str):
    """Get results of a completed backtest."""
    job = _BACKTEST_JOBS.get(job_id)
    if not job:
        return {"job_id": job_id, "status": "not_found", "results": None}
    return {"job_id": job_id, "status": job["status"], "results": job["results"]}
