"""Market data API endpoints."""

from fastapi import APIRouter, Query
from ...core import runtime

router = APIRouter()


@router.get("/candles")
async def get_candles(
    symbol: str = Query(default="BTC/USDT"),
    timeframe: str = Query(default="1h"),
    limit: int = Query(default=500, le=2000),
):
    """Get historical OHLCV candles."""
    if runtime.aggregator is None:
        return {"symbol": symbol, "timeframe": timeframe, "data": [], "source": "unavailable"}

    candles = await runtime.aggregator.fetch_candles(symbol, timeframe, limit=limit)
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "data": [
            {
                "time": c.time,
                "open": c.open,
                "high": c.high,
                "low": c.low,
                "close": c.close,
                "volume": c.volume,
            }
            for c in candles
        ],
        "source": "aggregated",
    }


@router.get("/ticker")
async def get_ticker(symbol: str = Query(default="BTC/USDT")):
    """Get current ticker for a symbol."""
    if runtime.aggregator is None:
        return {"symbol": symbol, "price": 0, "change24h": 0, "volume24h": 0}

    tickers = await runtime.aggregator.fetch_tickers(symbol)
    if not tickers:
        return {"symbol": symbol, "price": 0, "change24h": 0, "volume24h": 0}

    vals = list(tickers.values())
    return {
        "symbol": symbol,
        "price": sum(t.price for t in vals) / len(vals),
        "change24h": sum(t.change_24h for t in vals) / len(vals),
        "volume24h": sum(t.volume_24h for t in vals),
    }


@router.get("/orderbook")
async def get_orderbook(
    symbol: str = Query(default="BTC/USDT"),
    depth: int = Query(default=20, le=100),
):
    """Get aggregated orderbook across exchanges."""
    if runtime.aggregator is None:
        return {"symbol": symbol, "bids": [], "asks": [], "timestamp": 0}

    ob = await runtime.aggregator.fetch_orderbook_aggregate(symbol, limit=depth)
    return {
        "symbol": symbol,
        "bids": ob.get("bids", []),
        "asks": ob.get("asks", []),
        "timestamp": ob.get("timestamp", 0),
    }


@router.get("/funding")
async def get_funding_rate(symbol: str = Query(default="BTC/USDT")):
    """Get current funding rate across exchanges."""
    if runtime.aggregator is None:
        return {"symbol": symbol, "rates": {}, "average": 0}

    rates = await runtime.aggregator.fetch_funding_rates(symbol)
    avg = sum(rates.values()) / len(rates) if rates else 0
    return {
        "symbol": symbol,
        "rates": rates,
        "average": avg,
    }


@router.get("/oi")
async def get_open_interest(symbol: str = Query(default="BTC/USDT")):
    """Get open interest across exchanges."""
    if runtime.aggregator is None:
        return {"symbol": symbol, "total": 0, "by_exchange": {}}

    by_exchange = await runtime.aggregator.fetch_open_interest_all(symbol)
    return {
        "symbol": symbol,
        "total": sum(by_exchange.values()),
        "by_exchange": by_exchange,
    }
