"""Dünne Hülle um die Claude API mit Kostenerfassung und Budget-Grenze."""
from __future__ import annotations

from typing import TypeVar

import anthropic
from pydantic import BaseModel

from .state import State

T = TypeVar("T", bound=BaseModel)

# USD pro 1 Mio. Tokens (Input, Output, Cache-Read)
PRICES = {
    "claude-opus-5-5": (4.0, 20.0, 0.20),
    "claude-sonnet-5-5": (2.0, 10.0, 0.20),
    "claude-haiku-4-5": (1.0, 5.0, 0.10),
}
WEB_SEARCH_USD = 10.0 / 1000
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class BudgetExceeded(RuntimeError):
    pass


class Refused(RuntimeError):
    pass


class LLM:
    def __init__(self, cfg: dict, state: State):
        self.client = anthropic.Anthropic(max_retries=4)
        self.model = cfg["agent"]["model"]
        self.effort = cfg["agent"]["effort"]
        self.budget = float(cfg["agent"]["monthly_budget_usd"])
        self.state = state
        self.run_cost = 0.0

    # ---- Kosten -----------------------------------------------------------
    def _check_budget(self) -> None:
        if self.state.spent_this_month() >= self.budget:
            raise BudgetExceeded(
                f"Monatsbudget von {self.budget:.2f} USD ist aufgebraucht."
            )

    def _account(self, msg) -> None:
        pin, pout, pcache = PRICES.get(self.model, PRICES["claude-opus-5-5"])
        u = msg.usage
        cost = (
            (u.input_tokens + (u.cache_creation_input_tokens or 0) * 1.25) * pin
            + (u.cache_read_input_tokens or 0) * pcache
            + u.output_tokens * pout
        ) / 1e6
        if u.server_tool_use and u.server_tool_use.web_search_requests:
            cost += u.server_tool_use.web_search_requests * WEB_SEARCH_USD
        self.run_cost += cost
        self.state.add_spend(cost)

    def _common(self, system: str) -> dict:
        return dict(
            model=self.model,
            system=system,
            thinking={"type": "adaptive"},
            output_config={"effort": self.effort},
            betas=[FALLBACK_BETA],
            fallbacks="default",
        )

    @staticmethod
    def _check_refusal(msg) -> None:
        if msg.stop_reason == "refusal":
            raise Refused(str(getattr(msg, "stop_details", "")))

    @staticmethod
    def _text(msg) -> str:
        return "".join(b.text for b in msg.content if b.type == "text").strip()

    # ---- Aufrufe ----------------------------------------------------------
    def research(self, prompt: str, system: str, max_searches: int = 8) -> str:
        """Freitext-Antwort mit Websuche (für Marktrecherche)."""
        self._check_budget()
        tools = [{"type": "web_search_20260209", "name": "web_search", "max_uses": max_searches}]
        messages = [{"role": "user", "content": prompt}]
        parts: list[str] = []
        for _ in range(5):  # pause_turn-Fortsetzungen begrenzen
            with self.client.beta.messages.stream(
                max_tokens=32000, tools=tools, messages=messages, **self._common(system)
            ) as stream:
                msg = stream.get_final_message()
            self._account(msg)
            self._check_refusal(msg)
            parts.append(self._text(msg))
            if msg.stop_reason != "pause_turn":
                break
            messages = [messages[0], {"role": "assistant", "content": msg.content}]
        return "\n".join(p for p in parts if p)

    def structured(self, prompt: str, schema: type[T], system: str) -> T:
        """Antwort als validiertes Pydantic-Objekt."""
        self._check_budget()
        msg = self.client.beta.messages.parse(
            max_tokens=16000,
            messages=[{"role": "user", "content": prompt}],
            output_format=schema,
            **self._common(system),
        )
        self._account(msg)
        self._check_refusal(msg)
        if msg.parsed_output is None:
            raise RuntimeError("Keine gültige strukturierte Antwort erhalten.")
        return msg.parsed_output

    def write(self, prompt: str, system: str, max_tokens: int = 64000) -> str:
        """Langer Freitext (Kapitel, HTML-Code)."""
        self._check_budget()
        with self.client.beta.messages.stream(
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            **self._common(system),
        ) as stream:
            msg = stream.get_final_message()
        self._account(msg)
        self._check_refusal(msg)
        if msg.stop_reason == "max_tokens":
            raise RuntimeError("Antwort wurde wegen max_tokens abgeschnitten.")
        return self._text(msg)
