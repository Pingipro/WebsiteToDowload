"""Offline-Test des kompletten Ablaufs mit einer Attrappe statt echter KI/Stripe.

Ausführen: python -m unittest discover tests
"""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from agent import builder, ideas, legal, main, site, state


class FakeLLM:
    run_cost = 0.0

    def __init__(self, *a, **k):
        pass

    def research(self, prompt, system, max_searches=8):
        return "Recherche-Ergebnis"

    def structured(self, prompt, schema, system):
        if schema is ideas.IdeaList:
            return ideas.IdeaList(ideas=[ideas.Idea(
                title="Umzugsplaner für Familien", product_type="download", audience="Familien",
                problem="Umzug ist chaotisch", solution="Checklisten und Zeitplan", price_eur=12,
                keywords=["umzug checkliste"], demand_evidence="Forenfragen", demand_score=7,
                competition_score=6, buildability_score=9)])
        if schema is legal.LegalCheck:
            return legal.LegalCheck(approved=True, risks=[], required_changes=[])
        if schema is builder.Outline:
            return builder.Outline(title="Umzugsplaner", subtitle="Stressfrei umziehen",
                                   chapters=[builder.Chapter(title="Planung", goals=["Zeitplan"])])
        if schema is builder.SalesCopy:
            return builder.SalesCopy(headline="Stressfrei umziehen", subheadline="Mit Plan",
                                     bullets=["Checklisten"], description_markdown="Text",
                                     faq=[builder.FAQ(question="Format?", answer="PDF")],
                                     meta_description="Umzugsplaner", blog_title="Umzug planen",
                                     blog_markdown="## Tipps\n\nText")
        raise AssertionError(schema)

    def write(self, prompt, system, max_tokens=64000):
        return "Inhalt\n\n- [ ] Kartons besorgen\n\n| A | B |\n|---|---|\n| 1 | 2 |"


class FakeStripe:
    pass


class SmokeTest(unittest.TestCase):
    def test_full_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            cfg = state.load_config()
            cfg["business"].update(name="Test", owner="Erika Muster", street="Weg 1", city="12345 Ort",
                                   email="a@b.de", site_url="https://shop.example")
            listing = {"stripe_product": "prod_1", "stripe_price": "price_1",
                       "payment_link_id": "plink_1", "payment_url": "https://buy.stripe.com/x"}
            patches = [
                mock.patch.object(main, "load_config", return_value=cfg),
                mock.patch.object(main, "LLM", FakeLLM),
                mock.patch.object(main, "DATA", root / "data"),
                mock.patch.object(main, "PRODUCTS", root / "products"),
                mock.patch.object(main, "STOP_FILE", root / "STOP"),
                mock.patch.object(state, "DATA", root / "data"),
                mock.patch.object(state, "STATE_FILE", root / "data" / "state.json"),
                mock.patch.object(site, "PRODUCTS", root / "products"),
                mock.patch.object(site, "DIST", root / "dist"),
                mock.patch.object(main.shop, "client", return_value=FakeStripe()),
                mock.patch.object(main.shop, "refresh_sales"),
                mock.patch.object(main.shop, "create_listing", return_value=listing),
                mock.patch.object(builder, "_to_pdf", return_value=False),
            ]
            for p in patches:
                p.start()
            self.addCleanup(mock.patch.stopall)
            (root / "data").mkdir()

            self.assertEqual(main.run(), 0)

            st = json.loads((root / "data" / "state.json").read_text())
            self.assertEqual(len(st["products"]), 1)
            prod = st["products"][0]
            self.assertEqual(prod["status"], "live")
            dist = root / "dist"
            self.assertTrue((dist / "p" / prod["slug"] / "index.html").exists())
            self.assertTrue((dist / "d" / prod["download_token"] / prod["file"]).exists())
            self.assertIn("Erika Muster", (dist / "impressum" / "index.html").read_text())
            self.assertIn("Disallow: /d/", (dist / "robots.txt").read_text())
            self.assertIn("noindex", (dist / "d" / prod["download_token"] / "index.html").read_text())

    def test_blocklist(self):
        self.assertIsNotNone(legal.blocked_by_rules("Krypto-Trading Signale"))
        self.assertIsNone(legal.blocked_by_rules("Wettbewerbsanalyse Vorlage"))


if __name__ == "__main__":
    unittest.main()
