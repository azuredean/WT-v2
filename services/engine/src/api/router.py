"""Root API router aggregating all sub-routers."""

from fastapi import APIRouter
from .v1 import market, signals, whale, backtest, trading, anomaly

api_router = APIRouter()

api_router.include_router(market.router, prefix="/market", tags=["market"])
api_router.include_router(signals.router, prefix="/signals", tags=["signals"])
api_router.include_router(whale.router, prefix="/whale", tags=["whale"])
api_router.include_router(backtest.router, prefix="/backtest", tags=["backtest"])
api_router.include_router(trading.router, prefix="/trading", tags=["trading"])
api_router.include_router(anomaly.router, prefix="/anomaly", tags=["anomaly"])
