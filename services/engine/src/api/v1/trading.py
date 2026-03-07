"""Trading API endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class OrderRequest(BaseModel):
    symbol: str
    side: str  # "buy" or "sell"
    order_type: str = "market"  # "market" or "limit"
    quantity: float
    price: float | None = None
    leverage: int | None = None
    exchange: str = "binance"


@router.get("/positions")
async def get_positions():
    """Get all open positions across exchanges."""
    # TODO: Phase 6 - Get from exchange APIs
    return {"positions": []}


@router.post("/order")
async def place_order(order: OrderRequest):
    """Place a trade order."""
    # TODO: Phase 6 - Execute via CCXT
    return {"order_id": "placeholder", "status": "not_implemented"}


@router.get("/history")
async def get_trade_history(limit: int = 50):
    """Get trade history."""
    return {"trades": []}
