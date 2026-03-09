"""Runtime singletons for engine services."""

from .exchange.aggregator import ExchangeAggregator


aggregator: ExchangeAggregator | None = None
