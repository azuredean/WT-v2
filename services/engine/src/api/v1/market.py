"""Market data API endpoints."""

from fastapi import APIRouter, Query

router = APIRouter()


@router.get("/candles")
async def get_candles(
    symbol: str = Query(default="BTC/USDT"),
    timeframe: str = Query(default="1h"),
    limit: int = Query(default=500, le=2000),
):
    """Get historical OHLCV candles.

    Phase 1: Returns from TimescaleDB.
    Currently returns placeholder data.
    """
    # TODO: Query TimescaleDB for historical candles
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "data": [],
        "source": "placeholder",
    }


@router.get("/ticker")
async def get_ticker(symbol: str = Query(default="BTC/USDT")):
    """Get current ticker for a symbol."""
    # TODO: Get from Redis cache
    return {
        "symbol": symbol,
        "price": 0,
        "change24h": 0,
        "volume24h": 0,
    }


@router.get("/orderbook")
async def get_orderbook(
    symbol: str = Query(default="BTC/USDT"),
    depth: int = Query(default=20, le=100),
):
    """Get aggregated orderbook across exchanges."""
    # TODO: Get from Redis cache, aggregate across exchanges
    return {
        "symbol": symbol,
        "bids": [],
        "asks": [],
        "timestamp": 0,
    }


@router.get("/funding")
async def get_funding_rate(symbol: str = Query(default="BTC/USDT")):
    """Get current funding rate across exchanges."""
    return {
        "symbol": symbol,
        "rates": {
            "binance": 0,
            "okx": 0,
            "bybit": 0,
        },
        "average": 0,
    }


@router.get("/oi")
async def get_open_interest(symbol: str = Query(default="BTC/USDT")):
    """Get open interest across exchanges."""
    return {
        "symbol": symbol,
        "total": 0,
        "by_exchange": {
            "binance": 0,
            "okx": 0,
            "bybit": 0,
        },
    }
