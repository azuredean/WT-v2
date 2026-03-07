"""Trade model."""

from sqlalchemy import Column, DateTime, Float, Integer, String, JSON
from .market import Base


class Trade(Base):
    """Executed trade record."""

    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    exchange = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    side = Column(String, nullable=False)
    entry_price = Column(Float)
    exit_price = Column(Float)
    quantity = Column(Float, nullable=False)
    entry_time = Column(DateTime(timezone=True), nullable=False)
    exit_time = Column(DateTime(timezone=True))
    pnl = Column(Float)
    pnl_pct = Column(Float)
    signal_id = Column(Integer)
    status = Column(String, nullable=False, default="open")
    order_ids = Column(JSON)
    metadata = Column(JSON)
