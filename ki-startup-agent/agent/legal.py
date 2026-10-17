"""Rechtliche Schutzschicht. Ersetzt keine Rechtsberatung, filtert aber die
häufigsten Risiken heraus, bevor etwas veröffentlicht wird."""
from __future__ import annotations

import re

from pydantic import BaseModel

from .llm import LLM

# Harte Sperrliste: trifft eines dieser Muster, wird die Idee sofort verworfen.
BLOCKED = [
    r"\bmedizin", r"\bheilung", r"\bheilmittel", r"\bheilt\b", r"\bdiagnos", r"\btherapie", r"\babnehm", r"\bdiät",
    r"\bnahrungsergänz", r"\bsteuerberat", r"\brechtsberat", r"\banlageberat",
    r"\btrading", r"\bkrypto", r"\bforex", r"\bsportwett", r"\bwetten\b", r"\bcasino", r"\bglücksspiel",
    r"\berotik", r"\bsex", r"\bwaffe", r"\bdrogen", r"\breich werden",
    r"\bpassives? einkommen garantiert", r"\bdisney\b", r"\bpokemon\b", r"\bmarvel\b",
    r"\bnintendo\b", r"\blego\b", r"\bharry potter\b", r"\bnetflix\b",
]

SYSTEM = """Du prüfst als vorsichtiger Compliance-Prüfer digitale Produkte für den
Verkauf in Deutschland/EU. Im Zweifel lehnst du ab. Prüfe insbesondere:
Markenrecht (fremde Marken im Namen oder Inhalt), Urheberrecht (kopierte Inhalte,
Nachahmung geschützter Werke), Heilversprechen, Einkommens- oder Erfolgsversprechen
(UWG, irreführende Werbung), regulierte Beratung (Recht, Steuern, Finanzen,
Medizin), Jugendschutz, Datenschutz (Webtools dürfen keine Daten an Server senden),
und ob die Verkaufstexte wahr sind."""


class LegalCheck(BaseModel):
    approved: bool
    risks: list[str]
    required_changes: list[str]


def blocked_by_rules(text: str) -> str | None:
    low = text.lower()
    for pat in BLOCKED:
        if re.search(pat, low):
            return pat
    return None


def review(llm: LLM, what: str, content: str, rules_text: str | None = None) -> LegalCheck:
    """rules_text: Text für die Sperrliste (Titel/Werbetext). Der volle
    Produktinhalt geht nur an die KI-Prüfung, weil Wörter wie "Therapie" in
    einem langen Text harmlos sein können."""
    hit = blocked_by_rules(rules_text if rules_text is not None else content)
    if hit:
        return LegalCheck(approved=False, risks=[f"Sperrliste: {hit}"], required_changes=[])
    return llm.structured(
        f"Prüfe {what}. Gib approved=false, wenn ein relevantes Risiko besteht.\n\n{content[:150000]}",
        LegalCheck,
        SYSTEM,
    )
