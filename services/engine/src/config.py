"""Application configuration using pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://whale:whale_secret@localhost:5432/whale_tracker"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Exchange API Keys
    binance_api_key: str = ""
    binance_api_secret: str = ""
    okx_api_key: str = ""
    okx_api_secret: str = ""
    okx_passphrase: str = ""
    bybit_api_key: str = ""
    bybit_api_secret: str = ""

    # Engine Settings
    default_symbol: str = "BTC/USDT"
    default_timeframe: str = "1h"

    # Anomaly Detection Thresholds
    flash_crash_threshold: float = 0.05  # 5% in 1 minute
    z_score_threshold: float = 3.0
    iqr_multiplier: float = 3.0
    min_consensus: int = 2

    # Data Quality
    min_data_quality_score: float = 0.7  # Below this = pause trading
    reduced_position_threshold: float = 0.85  # Below this = reduce position

    # Circuit Breaker
    market_drop_threshold: float = 0.15  # 15% 24h drop
    multi_exchange_outage: int = 2  # >= 2 exchanges down
    pause_duration_hours: int = 24

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
