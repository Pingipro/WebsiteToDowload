# KI-Startup-Agent

Ein Agent, der alle 6 Stunden per GitHub Actions läuft und dabei selbstständig:

1. **Ideen findet**: Er recherchiert im Web nach belegbarer Nachfrage und lernt aus den eigenen Verkaufszahlen.
2. **rechtlich prüft**: Eine harte Sperrliste und eine KI-Compliance-Prüfung (Marken, Urheberrecht, UWG, Heil- und Einkommensversprechen) werden einmal für die Idee und einmal für das fertige Produkt durchlaufen.
3. **das Produkt baut**:
   - **Download**: ein Leitfaden oder Vorlagen-Paket als PDF
   - **Web-Tool**: eine eigenständige HTML-App. Sie wird im Headless-Browser auf JS-Fehler und unerlaubte Netzwerkzugriffe getestet.
4. **verkauft**: Er legt Produkt, Preis und Zahlungslink in Stripe an. Beim Kauf stimmt der Kunde den AGB zu und verzichtet ausdrücklich auf das Widerrufsrecht für digitale Inhalte.
5. **vermarktet**: Er erstellt Landingpages mit SEO-Metadaten und strukturierten Daten, einen Ratgeber-Artikel pro Produkt und eine Sitemap.
6. **auswertet**: Er zählt Verkäufe pro Produkt und nimmt Ladenhüter nach 60 Tagen ohne Verkauf aus dem Shop.

Der Shop ist eine statische Website auf Cloudflare Pages (kostenlos). Den Bericht findest du nach jedem Lauf in `data/REPORT.md` und in der Zusammenfassung des GitHub-Actions-Laufs.

## Was du einmalig selbst tun musst

Das kann rechtlich nur eine Person erledigen:

1. **Gewerbe anmelden** beim Gewerbeamt (ca. 20–60 €), danach den Fragebogen zur steuerlichen Erfassung bei ELSTER ausfüllen. Für den Anfang reicht meist die Kleinunternehmerregelung (`small_business = true`).
2. **Stripe-Konto** anlegen und verifizieren (Ausweis, Bankkonto). Unter *Einstellungen → Öffentliche Details* trägst du die AGB-URL `<deine site_url>/agb/` ein. Ohne diesen Eintrag schlägt das Anlegen der Zahlungslinks fehl.
3. **Cloudflare-Konto** (kostenlos) anlegen und einen API-Token mit der Berechtigung *Cloudflare Pages: Edit* erstellen.
4. **Anthropic-API-Key** unter console.anthropic.com erstellen und Guthaben aufladen.
5. **`config.toml` ausfüllen**: Name, Anschrift, E-Mail und `site_url` (z. B. `https://ki-shop.pages.dev`). Solange etwas fehlt, baut der Agent zwar Produkte, verkauft aber nichts.
6. **Secrets im Repo hinterlegen** unter *Settings → Secrets and variables → Actions*:
   - `ANTHROPIC_API_KEY`
   - `STRIPE_SECRET_KEY`: zuerst `sk_test_…` zum Testen, später `sk_live_…`
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
7. Den ersten Lauf startest du unter *Actions → KI-Startup-Agent → Run workflow*.
8. **Rechtstexte prüfen lassen**: Impressum, Datenschutz und AGB unter `agent/site.py` sind solide Vorlagen, aber keine Rechtsberatung. Für ca. 10 €/Monat bieten z. B. IT-Recht Kanzlei oder Händlerbund abmahnsichere Texte an.

## Steuerung

| Was | Wie |
|---|---|
| Not-Aus | `enabled = false` in `config.toml` setzen oder eine Datei `STOP` ins Repo legen |
| Kosten begrenzen | `monthly_budget_usd` (Standard: 30 USD). Ist das Budget erreicht, stoppt der Agent bis zum Monatsende. |
| Tempo | `max_new_products_per_run` und den Cron-Zeitplan in `.github/workflows/agent.yml` anpassen |
| Nur Verkäufe/Website aktualisieren | *Run workflow* mit `skip_new` starten |
| Lokal testen | `pip install -r requirements.txt && python -m agent.main --dry-run` |
| Tests | `python -m unittest discover tests` |

## Ehrliche Erwartungen

- **Kosten**: Ein Produkt kostet etwa 0,50–3 USD an API-Gebühren. Dazu kommen die Stripe-Gebühren (ca. 1,5 % + 0,25 € je Verkauf).
- **Einnahmen**: Am Anfang wird kaum etwas verkauft. Neue Websites brauchen Monate, bis Google sie rankt, und ohne Besucher gibt es keine Verkäufe. Der Agent baut mit Ratgeber-Artikeln Suchmaschinen-Traffic auf. Schneller geht es, wenn du die Produkte zusätzlich manuell teilst, etwa auf Pinterest, Reddit (Regeln beachten) oder in Facebook-Gruppen.
- **Haftung**: Du bist der Verkäufer und haftest für jedes Produkt. Schau dir regelmäßig an, was der Agent veröffentlicht. `data/REPORT.md` listet alles auf.
- **Download-Links**: Die Links sind geheim und lassen sich nicht erraten. Wer sie weitergibt, ermöglicht aber Downloads ohne Kauf. Für kleine Produkte ist das üblich und vertretbar.
- **Micro-SaaS**: Abo-Dienste mit Server, Nutzerkonten und Support baut der Agent bewusst noch nicht vollautomatisch. Laufende Server, Datenschutz für Nutzerdaten und Support-Pflichten sind ohne menschliche Aufsicht zu riskant. Die Web-Tools sind der Zwischenschritt dorthin: Ein Tool, das sich gut verkauft, ist ein guter Kandidat, um es später mit dir zu einem SaaS auszubauen.
