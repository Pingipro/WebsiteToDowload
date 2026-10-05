"""Persistenter Zustand (data/state.json), wird nach jedem Lauf committet."""
from __future__ import annotations

import json
import tomllib
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PRODUCTS = ROOT / "products"
STATE_FILE = DATA / "state.json"
STOP_FILE = ROOT / "STOP"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def month_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def load_config(path: Path | None = None) -> dict:
    with open(path or ROOT / "config.toml", "rb") as f:
        return tomllib.load(f)


def legal_ready(cfg: dict) -> tuple[bool, list[str]]:
    """Ohne vollständiges Impressum wird nichts verkauft."""
    required = ["name", "owner", "street", "city", "email", "site_url"]
    missing = [k for k in required if not str(cfg["business"].get(k, "")).strip()]
    return not missing, missing


class State:
    def __init__(self, data: dict):
        self.data = data
        self.data.setdefault("products", [])
        self.data.setdefault("rejected_ideas", [])
        self.data.setdefault("spend_usd", {})
        self.data.setdefault("runs", [])

    @classmethod
    def load(cls) -> "State":
        if STATE_FILE.exists():
            return cls(json.loads(STATE_FILE.read_text(encoding="utf-8")))
        return cls({})

    def save(self) -> None:
        DATA.mkdir(exist_ok=True)
        self.data["runs"] = self.data["runs"][-200:]
        self.data["rejected_ideas"] = self.data["rejected_ideas"][-300:]
        STATE_FILE.write_text(
            json.dumps(self.data, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    @property
    def products(self) -> list[dict]:
        return self.data["products"]

    def active_products(self) -> list[dict]:
        return [p for p in self.products if p.get("status") == "live"]

    def spent_this_month(self) -> float:
        return self.data["spend_usd"].get(month_key(), 0.0)

    def add_spend(self, usd: float) -> None:
        k = month_key()
        self.data["spend_usd"][k] = round(self.data["spend_usd"].get(k, 0.0) + usd, 4)

    def known_titles(self) -> list[str]:
        return [p["title"] for p in self.products] + [
            r["title"] for r in self.data["rejected_ideas"]
        ]
