"""Signal models."""

from sqlalchemy import Column, DateTime, Float, String, JSON
from .market import Base


class Signal(Base):
    """Individual strategy signal — TimescaleDB hypertable."""

    __tablename__ = "signals"

    time = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    symbol = Column(String, primary_key=True, nullable=False)
    strategy_id = Column(String, primary_key=True, nullable=False)
    direction = Column(String, nullable=False)  # 'long', 'short', 'neutral'
    strength = Column(Float)
    confidence = Column(Float)
    metadata = Column(JSON)
    data_quality_score = Column(Float)


class FusedSignal(Base):
    """Fused signal from all strategies — TimescaleDB hypertable."""

    __tablename__ = "fused_signals"

    time = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    symbol = Column(String, primary_key=True, nullable=False)
    direction = Column(String, nullable=False)
    strength = Column(Float)
    confidence = Column(Float)
    contributing_strategies = Column(JSON)
    data_quality_score = Column(Float)
    recommended_size = Column(Float)
    anomaly_flags = Column(JSON)
