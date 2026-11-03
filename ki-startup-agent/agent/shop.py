"""Stripe: Produkte anlegen, Zahlungslinks erstellen, Verkäufe auswerten."""
from __future__ import annotations

import os
from datetime import datetime, timezone

import stripe


def client() -> stripe.StripeClient | None:
    key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    return stripe.StripeClient(key, max_network_retries=3) if key else None


def is_live() -> bool:
    return os.environ.get("STRIPE_SECRET_KEY", "").startswith(("sk_live_", "rk_live_"))


def create_listing(sc: stripe.StripeClient, product: dict, cfg: dict) -> dict:
    site = cfg["business"]["site_url"].rstrip("/")
    prod = sc.v1.products.create(params={
        "name": product["title"],
        "description": product["copy"]["subheadline"][:300],
        "url": f"{site}/p/{product['slug']}/",
        "tax_code": "txcd_10000000",  # digitale Güter / elektronisch erbrachte Leistungen
        "metadata": {"agent_slug": product["slug"]},
    })
    price = sc.v1.prices.create(params={
        "product": prod.id,
        "unit_amount": int(product["price_eur"]) * 100,
        "currency": cfg["shop"]["currency"],
    })
    params: dict = {
        "line_items": [{"price": price.id, "quantity": 1}],
        "after_completion": {
            "type": "redirect",
            "redirect": {"url": f"{site}/d/{product['download_token']}/"},
        },
        "metadata": {"agent_slug": product["slug"]},
        "custom_text": {"submit": {"message": (
            "Sie erhalten nach der Zahlung sofort den Download-Link. Bitte speichern Sie "
            "die Datei direkt; der Link wird Ihnen nicht per E-Mail gesendet."
        )}},
    }
    if cfg["shop"].get("require_tos_consent", True):
        params["consent_collection"] = {"terms_of_service": "required"}
        params["custom_text"]["terms_of_service_acceptance"] = {"message": (
            f"Ich stimme den [AGB]({site}/agb/) zu und verlange ausdrücklich, dass vor Ablauf "
            "der Widerrufsfrist mit der Bereitstellung des digitalen Inhalts begonnen wird. "
            "Mir ist bekannt, dass ich dadurch mein Widerrufsrecht verliere."
        )}
    link = sc.v1.payment_links.create(params=params)
    return {"stripe_product": prod.id, "stripe_price": price.id,
            "payment_link_id": link.id, "payment_url": link.url}


def deactivate(sc: stripe.StripeClient, product: dict) -> None:
    if product.get("payment_link_id"):
        sc.v1.payment_links.update(product["payment_link_id"], params={"active": False})


def refresh_sales(sc: stripe.StripeClient, products: list[dict]) -> None:
    """Zählt bezahlte Checkout-Sessions je Zahlungslink."""
    for p in products:
        if not p.get("payment_link_id"):
            continue
        count, revenue, last = 0, 0, p.get("last_sale")
        sessions = sc.v1.checkout.sessions.list(params={"payment_link": p["payment_link_id"], "limit": 100})
        for s in sessions.auto_paging_iter():
            if s.payment_status != "paid":
                continue
            count += 1
            revenue += s.amount_total or 0
            ts = datetime.fromtimestamp(s.created, timezone.utc).isoformat(timespec="seconds")
            last = max(last or ts, ts)
        p["sales"], p["revenue_eur"], p["last_sale"] = count, revenue / 100, last
