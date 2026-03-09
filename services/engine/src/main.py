"""Whale Tracker V2 - FastAPI Engine Entry Point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api.router import api_router
from .core.exchange.aggregator import ExchangeAggregator
from .core.exchange.binance import BinanceExchange
from .core.exchange.okx import OKXExchange
from .core.exchange.bybit import BybitExchange
from .core import runtime


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("🐳 Whale Tracker Engine starting...")
    # Initialize exchange aggregator
    runtime.aggregator = ExchangeAggregator(
        [
            BinanceExchange(settings.binance_api_key, settings.binance_api_secret),
            OKXExchange(settings.okx_api_key, settings.okx_api_secret, settings.okx_passphrase),
            BybitExchange(settings.bybit_api_key, settings.bybit_api_secret),
        ]
    )
    await runtime.aggregator.connect_all()
    yield
    print("🐳 Whale Tracker Engine shutting down...")
    if runtime.aggregator:
        await runtime.aggregator.disconnect_all()


app = FastAPI(
    title="Whale Tracker V2 Engine",
    description="Market Participant Profiling & Trading Engine API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "whale-tracker-engine"}
