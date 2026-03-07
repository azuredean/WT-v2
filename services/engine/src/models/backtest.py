"""Backtest run model."""

from sqlalchemy import Column, DateTime, Integer, String, JSON, func
from .market import Base


class BacktestRun(Base):
    """Backtesting job and results."""

    __tablename__ = "backtest_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, nullable=False, default="pending")
    config = Column(JSON, nullable=False)
    results = Column(JSON)
    equity_curve = Column(JSON)
    trade_log = Column(JSON)
