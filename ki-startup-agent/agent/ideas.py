"""Ideenfindung: Marktrecherche im Web und Bewertung der Kandidaten."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from .llm import LLM
from .state import State

SYSTEM = """Du bist ein nüchterner Gründer, der kleine digitale Produkte baut, die
sich ohne Support und ohne laufende Kosten verkaufen. Du suchst echte, belegbare
Nachfrage (Forenfragen, Suchanfragen, Beschwerden über bestehende Lösungen) und
meidest gesättigte Nischen. Du bewertest ehrlich und erfindest keine Belege."""


class Idea(BaseModel):
    title: str = Field(description="Produktname, kurz und konkret")
    product_type: Literal["download", "webtool"] = Field(
        description="download = E-Book/Leitfaden/Vorlagen-Paket; webtool = eigenständige HTML-App (Rechner, Generator, Planer)"
    )
    audience: str
    problem: str
    solution: str = Field(description="Was genau der Käufer bekommt")
    price_eur: int
    keywords: list[str] = Field(description="SEO-Suchbegriffe, nach denen die Zielgruppe sucht")
    demand_evidence: str = Field(description="Konkrete Belege aus der Recherche, mit Quelle")
    demand_score: int = Field(description="1-10, wie stark die belegte Nachfrage ist")
    competition_score: int = Field(description="1-10, 10 = kaum gute Konkurrenz")
    buildability_score: int = Field(description="1-10, 10 = von einer KI ohne Menschen in hoher Qualität baubar")


class IdeaList(BaseModel):
    ideas: list[Idea]


def _performance_summary(state: State) -> str:
    lines = []
    for p in state.products:
        lines.append(
            f"- {p['title']} ({p['product_type']}, {p['price_eur']} €): "
            f"{p.get('sales', 0)} Verkäufe, Status {p['status']}"
        )
    return "\n".join(lines) or "(noch keine Produkte)"


def find_idea(llm: LLM, state: State, cfg: dict) -> Idea | None:
    lang = cfg["agent"]["language"]
    lo, hi = cfg["shop"]["min_price"], cfg["shop"]["max_price"]
    known = "\n".join(f"- {t}" for t in state.known_titles()[-150:]) or "(keine)"

    research = llm.research(
        f"""Recherchiere im Web nach 6 Ideen für kleine digitale Produkte
(Sprache des Produkts: {lang}), die Menschen heute kaufen würden.

Erlaubt sind zwei Produktarten:
1. "download": Leitfaden, Vorlagen-Paket, Checklisten, Arbeitsbuch
2. "webtool": eigenständige HTML/JS-App ohne Server (Rechner, Planer, Generator)

Für jede Idee: Zielgruppe, Problem, Lösung, Preis zwischen {lo} und {hi} €,
SEO-Suchbegriffe und KONKRETE Belege für Nachfrage mit Quelle.

Bisherige Produkte und ihre Verkäufe (lerne daraus, welche Nischen laufen):
{_performance_summary(state)}

Diese Ideen gibt es schon oder wurden abgelehnt, nicht wiederholen:
{known}

Tabu: Medizin/Gesundheitsversprechen, Finanz-, Steuer-, Rechtsberatung,
Glücksspiel, Erwachsenenthemen, Waffen, Krypto-Trading, Markennamen Dritter,
Inhalte, die Urheberrecht verletzen, und alles mit Einkommensversprechen.""",
        SYSTEM,
    )

    ideas = llm.structured(
        f"Überführe diese Recherche in strukturierte Ideen. Bewerte streng.\n\n{research}",
        IdeaList,
        SYSTEM,
    ).ideas

    known_lower = {t.lower() for t in state.known_titles()}
    ideas = [
        i for i in ideas
        if i.title.lower() not in known_lower and lo <= i.price_eur <= hi
    ]
    if not ideas:
        return None
    return max(
        ideas,
        key=lambda i: i.demand_score * 2 + i.competition_score + i.buildability_score * 1.5,
    )
