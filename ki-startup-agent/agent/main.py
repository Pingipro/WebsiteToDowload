"""Ein Durchlauf des Agenten. Wird per GitHub Actions regelmäßig gestartet.

Ablauf: Not-Aus prüfen -> Verkäufe abrufen -> Ladenhüter auslisten ->
neue Idee finden -> Rechtscheck -> Produkt bauen -> Rechtscheck des Produkts ->
in Stripe einstellen -> Website bauen -> Bericht schreiben.
"""
from __future__ import annotations

import argparse
import json
import os
import secrets
import shutil
import sys
import traceback
from datetime import datetime, timedelta, timezone

from . import builder, legal, shop, site
from .ideas import find_idea
from .llm import LLM, BudgetExceeded, Refused
from .state import DATA, PRODUCTS, STOP_FILE, State, legal_ready, load_config, now_iso


def log(msg: str) -> None:
    print(f"[{now_iso()}] {msg}", flush=True)


def retire_slow_sellers(state: State, cfg: dict, sc) -> None:
    days = int(cfg["agent"].get("retire_after_days_without_sale", 0))
    if not days:
        return
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    for p in state.active_products():
        ref = datetime.fromisoformat(p.get("last_sale") or p["listed_at"])
        if ref < cutoff:
            log(f"Liste aus (keine Verkäufe seit {days} Tagen): {p['title']}")
            if sc:
                shop.deactivate(sc, p)
            p["status"] = "retired"


def create_product(llm: LLM, state: State, cfg: dict, can_sell: bool, sc) -> dict | None:
    lang = cfg["agent"]["language"]
    idea = find_idea(llm, state, cfg)
    if not idea:
        log("Keine neue, passende Idee gefunden.")
        return None
    log(f"Idee: {idea.title} ({idea.product_type}, {idea.price_eur} €)")

    idea_text = idea.model_dump_json(indent=2)
    check = legal.review(llm, "diese Produktidee", idea_text,
                         rules_text=f"{idea.title} {idea.problem} {idea.solution}")
    if not check.approved:
        log(f"Idee abgelehnt (Recht): {check.risks}")
        state.data["rejected_ideas"].append({"title": idea.title, "reason": check.risks, "at": now_iso()})
        return None

    slug = builder.slugify(idea.title)
    while (PRODUCTS / slug).exists():
        slug = f"{slug}-{secrets.token_hex(2)}"
    out = PRODUCTS / slug
    out.mkdir(parents=True)
    try:
        imprint = site.imprint_line(cfg) if can_sell else cfg["business"]["brand"]
        if idea.product_type == "webtool":
            file = builder.build_webtool(llm, idea, out, lang, imprint)
            excerpt = (out / file).read_text(encoding="utf-8")
        else:
            file = builder.build_download(llm, idea, out, lang, imprint)
            excerpt = (out / "inhalt.md").read_text(encoding="utf-8")
        copy = builder.build_sales_copy(llm, idea, lang, excerpt)
        final = legal.review(
            llm, "dieses fertige Produkt samt Verkaufstexten",
            f"VERKAUFSTEXT:\n{copy.model_dump_json(indent=2)}\n\nPRODUKT:\n{excerpt}",
            rules_text=f"{copy.headline} {copy.subheadline} {' '.join(copy.bullets)}",
        )
        if not final.approved:
            raise RuntimeError(f"Fertiges Produkt abgelehnt (Recht): {final.risks}")
    except Exception as exc:
        shutil.rmtree(out, ignore_errors=True)
        state.data["rejected_ideas"].append({"title": idea.title, "reason": str(exc)[:500], "at": now_iso()})
        raise

    product = {
        "slug": slug,
        "title": idea.title,
        "product_type": idea.product_type,
        "price_eur": idea.price_eur,
        "file": file,
        "idea": json.loads(idea_text),
        "copy": copy.model_dump(),
        "download_token": secrets.token_urlsafe(24),
        "created_at": now_iso(),
        "status": "built",
        "sales": 0,
    }
    (out / "product.json").write_text(json.dumps(product, indent=2, ensure_ascii=False), encoding="utf-8")
    if can_sell and sc:
        product.update(shop.create_listing(sc, product, cfg))
        product["status"] = "live"
        product["listed_at"] = now_iso()
        log(f"Live im Shop: {product['payment_url']}")
    else:
        log("Produkt gebaut, aber nicht verkauft (Impressum/Stripe fehlt oder Probelauf).")
    state.products.append(product)
    return product


def list_waiting_products(state: State, cfg: dict, sc) -> None:
    """Sobald Impressum und Stripe da sind, werden bereits gebaute Produkte eingestellt."""
    for p in state.products:
        if p["status"] == "built":
            p.update(shop.create_listing(sc, p, cfg))
            p["status"] = "live"
            p["listed_at"] = now_iso()
            log(f"Nachträglich live: {p['title']}")


def write_report(state: State, cfg: dict, run: dict) -> None:
    live = state.active_products()
    total_rev = sum(p.get("revenue_eur", 0) for p in state.products)
    lines = [
        "# Agenten-Bericht", "",
        f"Letzter Lauf: {run['finished_at']} · Ergebnis: {run['result']}",
        f"API-Kosten diesen Monat: {state.spent_this_month():.2f} / {cfg['agent']['monthly_budget_usd']:.2f} USD",
        f"Umsatz gesamt: {total_rev:.2f} € · Live-Produkte: {len(live)} · Stripe-Modus: {'LIVE' if shop.is_live() else 'Test/keiner'}",
        "", "| Produkt | Typ | Preis | Verkäufe | Umsatz | Status |", "|---|---|---|---|---|---|",
    ]
    for p in sorted(state.products, key=lambda p: p.get("revenue_eur", 0), reverse=True):
        lines.append(f"| {p['title']} | {p['product_type']} | {p['price_eur']} € | {p.get('sales', 0)} | "
                     f"{p.get('revenue_eur', 0):.2f} € | {p['status']} |")
    if run.get("notes"):
        lines += ["", "## Hinweise", *[f"- {n}" for n in run["notes"]]]
    text = "\n".join(lines) + "\n"
    (DATA / "REPORT.md").write_text(text, encoding="utf-8")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(text)


def run(dry_run: bool = False, skip_new: bool = False) -> int:
    cfg = load_config()
    state = State.load()
    run_info = {"started_at": now_iso(), "notes": []}
    notes = run_info["notes"]

    if not cfg["agent"].get("enabled", True) or STOP_FILE.exists():
        log("Not-Aus aktiv (config enabled=false oder Datei STOP). Nichts zu tun.")
        return 0

    ready, missing = legal_ready(cfg)
    if not ready:
        notes.append(f"Impressum unvollständig, Verkauf gesperrt. Fehlt: {', '.join(missing)}")
    sc = None if dry_run else shop.client()
    if not sc:
        notes.append("Kein STRIPE_SECRET_KEY gesetzt (oder Probelauf): es wird nichts verkauft.")
    can_sell = ready and sc is not None

    exit_code, result = 0, "ok"
    try:
        if sc:
            shop.refresh_sales(sc, state.products)
            retire_slow_sellers(state, cfg, sc)
        if can_sell:
            list_waiting_products(state, cfg, sc)

        if not skip_new:
            if len(state.active_products()) >= cfg["agent"]["max_active_products"]:
                notes.append("Maximale Anzahl aktiver Produkte erreicht.")
            else:
                llm = LLM(cfg, state)
                for _ in range(int(cfg["agent"]["max_new_products_per_run"])):
                    try:
                        p = create_product(llm, state, cfg, can_sell, sc)
                        if p:
                            notes.append(f"Neues Produkt: {p['title']} ({p['status']})")
                    except (BudgetExceeded, Refused):
                        raise
                    except Exception as exc:
                        log(f"Produkt fehlgeschlagen: {exc}")
                        traceback.print_exc()
                        notes.append(f"Produkt fehlgeschlagen: {str(exc)[:300]}")
                    finally:
                        state.save()  # Kosten auch bei Fehlern festhalten
                notes.append(f"API-Kosten dieses Laufs: {llm.run_cost:.2f} USD")
    except BudgetExceeded as exc:
        notes.append(str(exc))
        result = "budget"
    except Refused as exc:
        notes.append(f"Anfrage von der KI abgelehnt: {exc}")
        result = "refused"
    except Exception as exc:
        traceback.print_exc()
        notes.append(f"Fehler: {exc}")
        result, exit_code = "error", 1

    if cfg["business"].get("site_url"):
        site.build(cfg, state.products)
    else:
        notes.append("Keine site_url gesetzt, Website wird nicht gebaut.")
    run_info.update(finished_at=now_iso(), result=result)
    state.data["runs"].append(run_info)
    state.save()
    write_report(state, cfg, run_info)
    for n in notes:
        log(n)
    return exit_code


def main() -> None:
    ap = argparse.ArgumentParser(description="KI-Startup-Agent: ein Durchlauf")
    ap.add_argument("--dry-run", action="store_true", help="nichts in Stripe anlegen")
    ap.add_argument("--skip-new", action="store_true", help="kein neues Produkt bauen, nur Verkäufe/Website aktualisieren")
    args = ap.parse_args()
    sys.exit(run(dry_run=args.dry_run, skip_new=args.skip_new))


if __name__ == "__main__":
    main()
