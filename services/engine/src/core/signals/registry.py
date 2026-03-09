"""Strategy registry — discovers, loads, and manages strategy plugins."""

import importlib
import json
from pathlib import Path
from typing import Any

from .base import IStrategy


class StrategyRegistry:
    """Discovers, loads, and manages strategy plugins."""

    def __init__(self):
        self._strategies: dict[str, IStrategy] = {}

    def register(self, strategy: IStrategy) -> None:
        """Register a strategy instance."""
        self._strategies[strategy.name] = strategy
        print(f"[Registry] Registered strategy: {strategy.name} v{strategy.version}")

    def unregister(self, name: str) -> None:
        """Remove a strategy from the registry."""
        if name in self._strategies:
            del self._strategies[name]

    def get(self, name: str) -> IStrategy | None:
        """Get a strategy by name."""
        return self._strategies.get(name)

    def get_all(self) -> list[IStrategy]:
        """Get all registered strategies."""
        return list(self._strategies.values())

    def list_names(self) -> list[str]:
        """List all registered strategy names."""
        return list(self._strategies.keys())

    def discover_builtins(self) -> None:
        """Load all built-in strategies (S1-S8)."""
        builtin_modules = [
            "s1_whale_tracking",
            "s2_capital_concentration",
            "s3_funding_reversal",
            "s4_liquidity_grab",
            "s5_oi_divergence",
            "s6_retail_counter",
            "s7_stop_hunt",
            "s8_smart_money_edge",
        ]

        for module_name in builtin_modules:
            try:
                module = importlib.import_module(
                    f".{module_name}", package=__package__
                )
                # Each module should have a `Strategy` class
                strategy_cls = getattr(module, "Strategy", None)
                if strategy_cls and issubclass(strategy_cls, IStrategy):
                    self.register(strategy_cls())
            except (ImportError, AttributeError) as e:
                print(f"[Registry] Skipping {module_name}: {e}")

    def discover_plugins(self, plugin_dir: Path) -> None:
        """Scan plugin directory for manifest.json files and load strategy classes."""
        if not plugin_dir.exists():
            return

        for manifest_path in plugin_dir.glob("*/manifest.json"):
            try:
                manifest = json.loads(manifest_path.read_text())
                module_path = manifest.get("module", "")
                class_name = manifest.get("class", "Strategy")

                module = importlib.import_module(module_path)
                strategy_cls = getattr(module, class_name)

                if issubclass(strategy_cls, IStrategy):
                    self.register(strategy_cls())
                    print(f"[Registry] Loaded plugin: {manifest.get('name', 'unknown')}")
            except Exception as e:
                print(f"[Registry] Failed to load plugin from {manifest_path}: {e}")

    def to_dict(self) -> list[dict[str, Any]]:
        """Serialize registry to list of strategy info dicts."""
        return [
            {
                "id": s.name,
                "name": s.name,
                "version": s.version,
                "description": s.description,
                "required_data": s.required_data,
                "min_candles": s.min_candles,
            }
            for s in self._strategies.values()
        ]
