"""Baut das eigentliche Produkt und die Verkaufstexte."""
from __future__ import annotations

import html
import os
import re
import secrets
import unicodedata
from pathlib import Path

import markdown
from pydantic import BaseModel

from .ideas import Idea
from .llm import LLM

WRITER = """Du bist ein erfahrener Fachautor und Produktentwickler. Du schreibst
konkret, praxisnah und ehrlich, ohne Füllsätze, ohne Übertreibungen und ohne
Erfolgs- oder Einkommensversprechen. Du kopierst keine fremden Texte."""

DEVELOPER = """Du bist ein sorgfältiger Frontend-Entwickler. Du lieferst eine
einzige, vollständige HTML-Datei mit eingebettetem CSS und JavaScript, ohne
externe Abhängigkeiten, ohne Netzwerkzugriffe, ohne Tracking. Daten bleiben im
Browser (localStorage ist erlaubt). Die App ist responsiv, barrierearm und
funktioniert offline."""


class Chapter(BaseModel):
    title: str
    goals: list[str]


class Outline(BaseModel):
    title: str
    subtitle: str
    chapters: list[Chapter]


class FAQ(BaseModel):
    question: str
    answer: str


class SalesCopy(BaseModel):
    headline: str
    subheadline: str
    bullets: list[str]
    description_markdown: str
    faq: list[FAQ]
    meta_description: str
    blog_title: str
    blog_markdown: str


def slugify(text: str) -> str:
    text = text.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:60] or secrets.token_hex(4)


def _idea_brief(idea: Idea) -> str:
    return (
        f"Produkt: {idea.title}\nArt: {idea.product_type}\nZielgruppe: {idea.audience}\n"
        f"Problem: {idea.problem}\nLösung: {idea.solution}\nPreis: {idea.price_eur} €"
    )


# ---- Download-Produkte ----------------------------------------------------
BOOK_CSS = """
body{font-family:Georgia,'Times New Roman',serif;max-width:46rem;margin:0 auto;padding:2.5rem 1.5rem;line-height:1.65;color:#1d1d1f}
h1{font-size:2.2rem;margin:0 0 .3rem}h2{margin-top:3rem;border-bottom:2px solid #e5e5ea;padding-bottom:.3rem;page-break-before:always}
h3{margin-top:1.8rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:.4rem .6rem;text-align:left}
.cover{min-height:85vh;display:flex;flex-direction:column;justify-content:center}.sub{font-size:1.25rem;color:#555}
.legal{font-size:.8rem;color:#777;margin-top:4rem}
@media print{body{padding:0}}
"""


def build_download(llm: LLM, idea: Idea, out: Path, lang: str, imprint: str) -> str:
    outline = llm.structured(
        f"Erstelle die Gliederung (6-10 Kapitel) für dieses Produkt in Sprache '{lang}'. "
        f"Es soll echten, sofort nutzbaren Mehrwert liefern (Checklisten, Vorlagen, Beispiele).\n\n{_idea_brief(idea)}",
        Outline,
        WRITER,
    )
    chapters_md = []
    for i, ch in enumerate(outline.chapters, 1):
        previous = ", ".join(c.title for c in outline.chapters[: i - 1]) or "keine"
        md = llm.write(
            f"Schreibe Kapitel {i} \"{ch.title}\" für \"{outline.title}\" in Sprache '{lang}' "
            f"als Markdown (ohne Kapitelüberschrift erster Ebene, beginne mit Fließtext; "
            f"Unterüberschriften mit ###). Ziele: {'; '.join(ch.goals)}.\n"
            f"Bereits geschriebene Kapitel: {previous}.\n"
            f"Nutze konkrete Beispiele, Tabellen und abhakbare Checklisten ('- [ ]').\n\n{_idea_brief(idea)}",
            WRITER,
            max_tokens=32000,
        )
        chapters_md.append(f"## {i}. {ch.title}\n\n{md}")

    body = markdown.markdown("\n\n".join(chapters_md), extensions=["tables", "sane_lists"])
    body = body.replace("[ ]", "☐")
    doc = f"""<!doctype html><html lang="{lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(outline.title)}</title>
<style>{BOOK_CSS}</style></head><body>
<section class="cover"><h1>{html.escape(outline.title)}</h1><p class="sub">{html.escape(outline.subtitle)}</p></section>
{body}
<p class="legal">Alle Inhalte wurden nach bestem Wissen mit KI-Unterstützung erstellt und ersetzen keine individuelle
Fachberatung. Nur für den persönlichen Gebrauch des Käufers; Weiterverkauf und Weitergabe sind nicht gestattet.<br>{html.escape(imprint)}</p>
</body></html>"""
    (out / "produkt.html").write_text(doc, encoding="utf-8")
    pdf = _to_pdf(out / "produkt.html", out / "produkt.pdf")
    full_text = "\n\n".join(chapters_md)
    (out / "inhalt.md").write_text(full_text, encoding="utf-8")
    return "produkt.pdf" if pdf else "produkt.html"


def _launch(p):
    # CHROMIUM_PATH erlaubt einen vorinstallierten Browser statt "playwright install".
    return p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)


def _to_pdf(src: Path, dst: Path) -> bool:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return False
    try:
        with sync_playwright() as p:
            browser = _launch(p)
            page = browser.new_page()
            page.goto(src.resolve().as_uri())
            page.pdf(path=str(dst), format="A4", print_background=True,
                     margin={"top": "18mm", "bottom": "18mm", "left": "16mm", "right": "16mm"})
            browser.close()
        return True
    except Exception as e:  # PDF ist nett, aber nicht zwingend
        print(f"PDF-Erzeugung fehlgeschlagen, liefere HTML aus: {e}")
        return False


# ---- Web-Tools ------------------------------------------------------------
def _extract_html(text: str) -> str:
    m = re.search(r"```(?:html)?\s*(<!doctype.*?</html>)\s*```", text, re.S | re.I)
    if m:
        return m.group(1)
    m = re.search(r"(<!doctype.*</html>)", text, re.S | re.I)
    if not m:
        raise RuntimeError("Kein HTML-Dokument in der Antwort gefunden.")
    return m.group(1)


def check_webtool(path: Path) -> list[str]:
    """Lädt das Tool im Headless-Browser: JS-Fehler und Netzwerkzugriffe sind Mängel."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return []
    problems: list[str] = []
    with sync_playwright() as p:
        browser = _launch(p)
        page = browser.new_page()

        def on_request(route):
            url = route.request.url
            if not url.startswith(("file:", "data:", "blob:", "about:")):
                problems.append(f"Unerlaubter Netzwerkzugriff: {url}")
                return route.abort()
            return route.continue_()

        page.route("**/*", on_request)
        page.on("pageerror", lambda e: problems.append(f"JS-Fehler: {e}"))
        page.on("console", lambda m: m.type == "error" and problems.append(f"Konsole: {m.text}"))
        page.goto(path.resolve().as_uri())
        page.wait_for_timeout(1500)
        if not page.inner_text("body").strip():
            problems.append("Die Seite zeigt keinen Inhalt.")
        browser.close()
    return problems


def build_webtool(llm: LLM, idea: Idea, out: Path, lang: str, imprint: str) -> str:
    prompt = (
        f"Baue dieses Web-Tool als eine vollständige HTML-Datei (Oberfläche in Sprache '{lang}'). "
        f"Es muss sofort nützlich sein, gut aussehen, Eingaben validieren und Ergebnisse "
        f"exportierbar machen (Kopieren, Drucken oder CSV-Download). Füge im Fußbereich diesen "
        f"Hinweis ein: \"Lizenz nur für den persönlichen Gebrauch des Käufers. {imprint}\". "
        f"Antworte nur mit dem Code in einem ```html-Block.\n\n{_idea_brief(idea)}"
    )
    path = out / "tool.html"
    problems: list[str] = []
    for _ in range(3):
        extra = ""
        if problems:
            extra = "\n\nDer vorherige Entwurf hatte diese Fehler, behebe sie:\n- " + "\n- ".join(problems[:20])
        path.write_text(_extract_html(llm.write(prompt + extra, DEVELOPER)), encoding="utf-8")
        problems = check_webtool(path)
        if not problems:
            return "tool.html"
    raise RuntimeError("Web-Tool besteht die Prüfung nicht: " + "; ".join(problems[:5]))


def build_sales_copy(llm: LLM, idea: Idea, lang: str, product_excerpt: str) -> SalesCopy:
    return llm.structured(
        f"Schreibe in Sprache '{lang}' die Verkaufsseite und einen hilfreichen, eigenständigen "
        f"SEO-Blogartikel (800-1200 Wörter, gibt echten Mehrwert und erwähnt das Produkt am Ende "
        f"dezent) für dieses Produkt. Nur wahre Aussagen, die der Produktinhalt belegt; keine "
        f"Fake-Bewertungen, keine künstliche Verknappung, keine Erfolgsversprechen. "
        f"Ziel-Suchbegriffe: {', '.join(idea.keywords)}.\n\n{_idea_brief(idea)}\n\n"
        f"Auszug aus dem Produkt:\n{product_excerpt[:20000]}",
        SalesCopy,
        WRITER,
    )
