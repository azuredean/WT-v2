"""Trading API endpoints."""

import time
import uuid

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

_POSITIONS: list[dict] = []
_TRADES: list[dict] = []


class OrderRequest(BaseModel):
    symbol: str
    side: str  # "buy" or "sell"
    order_type: str = "market"  # "market" or "limit"
    quantity: float
    price: float | None = None
    leverage: int | None = None
    exchange: str = "binance"


class ClosePositionRequest(BaseModel):
    position_id: str
    exit_price: float | None = None


@router.get("/positions")
async def get_positions():
    """Get all open positions across exchanges."""
    return {"positions": _POSITIONS}


@router.post("/order")
async def place_order(order: OrderRequest):
    """Place a trade order."""
    order_id = f"ord_{uuid.uuid4().hex[:10]}"
    now = int(time.time() * 1000)

    # local-sim execution path
    if order.order_type == "market":
        pos = {
            "id": order_id,
            "symbol": order.symbol,
            "side": order.side,
            "exchange": order.exchange,
            "quantity": order.quantity,
            "entry_price": order.price or 0,
            "opened_at": now,
            "leverage": order.leverage or 1,
        }
        _POSITIONS.append(pos)

    _TRADES.append(
        {
            "order_id": order_id,
            "symbol": order.symbol,
            "side": order.side,
            "order_type": order.order_type,
            "quantity": order.quantity,
            "price": order.price,
            "exchange": order.exchange,
            "timestamp": now,
        }
    )

    return {"order_id": order_id, "status": "accepted", "simulated": True}


@router.post("/close")
async def close_position(req: ClosePositionRequest):
    """Close one position by id (local simulation)."""
    idx = next((i for i, p in enumerate(_POSITIONS) if p.get("id") == req.position_id), -1)
    if idx < 0:
        return {"status": "not_found", "position_id": req.position_id}

    pos = _POSITIONS.pop(idx)
    exit_price = req.exit_price if req.exit_price is not None else float(pos.get("entry_price", 0) or 0)
    entry_price = float(pos.get("entry_price", 0) or 0)
    qty = float(pos.get("quantity", 0) or 0)
    side = str(pos.get("side", "buy")).lower()
    pnl = (exit_price - entry_price) * qty if side in ("buy", "long") else (entry_price - exit_price) * qty

    _TRADES.append(
        {
            "order_id": f"close_{uuid.uuid4().hex[:10]}",
            "symbol": pos.get("symbol"),
            "side": "sell" if side in ("buy", "long") else "buy",
            "order_type": "market",
            "quantity": qty,
            "price": exit_price,
            "exchange": pos.get("exchange", "binance"),
            "timestamp": int(time.time() * 1000),
            "realized_pnl": pnl,
            "closed_position_id": pos.get("id"),
        }
    )

    return {"status": "closed", "position_id": req.position_id, "realized_pnl": round(pnl, 4)}


@router.post("/close-all")
async def close_all_positions():
    """Close all open positions with zero-slippage simulation."""
    closed = 0
    total_pnl = 0.0
    for p in _POSITIONS[:]:
        result = await close_position(ClosePositionRequest(position_id=str(p.get("id")), exit_price=float(p.get("entry_price", 0) or 0)))
        if result.get("status") == "closed":
            closed += 1
            total_pnl += float(result.get("realized_pnl", 0))
    return {"status": "ok", "closed": closed, "total_realized_pnl": round(total_pnl, 4)}


@router.get("/history")
async def get_trade_history(limit: int = 50):
    """Get trade history."""
    return {"trades": _TRADES[-max(1, limit):]}
