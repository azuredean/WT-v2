"""Participant profile model."""

from sqlalchemy import Column, DateTime, Float, Integer, String, JSON
from .market import Base


class ParticipantProfile(Base):
    """Market participant classification profile."""

    __tablename__ = "participant_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    exchange = Column(String, nullable=False)
    account_hash = Column(String, nullable=False)  # anonymized identifier
    participant_type = Column(String, nullable=False)  # smart_whale, dumb_whale, etc.
    avg_position_size = Column(Float)
    win_rate = Column(Float)
    avg_leverage = Column(Float)
    counter_trend_ratio = Column(Float)
    last_classified = Column(DateTime(timezone=True), nullable=False)
    confidence = Column(Float)
    metadata = Column(JSON)
