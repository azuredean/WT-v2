"""Market data models (TimescaleDB hypertables)."""

from datetime import datetime
from sqlalchemy import Column, DateTime, Float, Integer, String
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Candle(Base):
    """OHLCV candle data — TimescaleDB hypertable."""

    __tablename__ = "candles"

    time = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    exchange = Column(String, primary_key=True, nullable=False)
    symbol = Column(String, primary_key=True, nullable=False)
    timeframe = Column(String, primary_key=True, nullable=False)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)
    quote_volume = Column(Float)
    trades_count = Column(Integer)


class FundingRate(Base):
    """Funding rate data — TimescaleDB hypertable."""

    __tablename__ = "funding_rates"

    time = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    exchange = Column(String, primary_key=True, nullable=False)
    symbol = Column(String, primary_key=True, nullable=False)
    funding_rate = Column(Float, nullable=False)
    predicted_rate = Column(Float)


class OpenInterest(Base):
    """Open interest data — TimescaleDB hypertable."""

    __tablename__ = "open_interest"

    time = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    exchange = Column(String, primary_key=True, nullable=False)
    symbol = Column(String, primary_key=True, nullable=False)
    oi_value = Column(Float, nullable=False)  # in USD
    oi_contracts = Column(Float)


class LargeTrade(Base):
    """Large trade events for whale detection — TimescaleDB hypertable."""

    __tablename__ = "large_trades"

    time = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    exchange = Column(String, primary_key=True, nullable=False)
    symbol = Column(String, primary_key=True, nullable=False)
    side = Column(String, nullable=False)  # 'buy' or 'sell'
    price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)
    value_usd = Column(Float, nullable=False)
    trade_id = Column(String)
