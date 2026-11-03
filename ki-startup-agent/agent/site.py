"""Erzeugt den statischen Shop (dist/) aus dem Zustand und den Produktordnern."""
from __future__ import annotations

import html
import json
import shutil
from datetime import date
from pathlib import Path

import markdown

from .state import PRODUCTS, ROOT

DIST = ROOT / "dist"
e = html.escape

CSS = """
:root{--bg:#fafaf7;--fg:#1c1c1e;--muted:#5f6368;--card:#fff;--line:#e4e4e0;--accent:#2457d6;--accent-fg:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#121214;--fg:#f2f2f2;--muted:#a1a1aa;--card:#1c1c1f;--line:#2e2e33;--accent:#7aa2ff;--accent-fg:#0b0b0d}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
a{color:var(--accent)}.wrap{max-width:68rem;margin:0 auto;padding:0 1rem}
header{border-bottom:1px solid var(--line);padding:1rem 0}header a{color:var(--fg);text-decoration:none;font-weight:700;font-size:1.15rem}
footer{border-top:1px solid var(--line);margin-top:4rem;padding:2rem 0;color:var(--muted);font-size:.9rem}footer a{color:var(--muted);margin-right:1rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(17rem,1fr));gap:1rem;margin:2rem 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:1.25rem;display:flex;flex-direction:column}
.card h3{margin:.2rem 0 .5rem;font-size:1.1rem}.card p{color:var(--muted);flex:1;margin:0 0 1rem}
.tag{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.btn{display:inline-block;background:var(--accent);color:var(--accent-fg);padding:.8rem 1.4rem;border-radius:10px;text-decoration:none;font-weight:600}
.hero{padding:3rem 0 1rem}.hero h1{font-size:clamp(1.8rem,4vw,2.8rem);line-height:1.15;margin:0 0 .75rem}.hero p{font-size:1.15rem;color:var(--muted);max-width:44rem}
.price{font-size:1.6rem;font-weight:700;margin:1.25rem 0 .25rem}.small{font-size:.85rem;color:var(--muted)}
article{max-width:44rem}ul.check{padding-left:1.2rem}details{border-bottom:1px solid var(--line);padding:.75rem 0}summary{cursor:pointer;font-weight:600}
table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}td,th{border:1px solid var(--line);padding:.4rem .6rem}
"""


def page(cfg: dict, title: str, body: str, *, desc: str = "", path: str = "/", noindex: bool = False, jsonld: dict | None = None) -> str:
    b = cfg["business"]
    site = b["site_url"].rstrip("/")
    meta = '<meta name="robots" content="noindex,nofollow">' if noindex else ""
    ld = f'<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>' if jsonld else ""
    return f"""<!doctype html><html lang="{cfg['agent']['language']}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)}</title>
<meta name="description" content="{e(desc)}">{meta}<link rel="canonical" href="{site}{path}">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}">
<style>{CSS}</style>{ld}</head><body>
<header><div class="wrap"><a href="/">{e(b['brand'])}</a></div></header>
<main class="wrap">{body}</main>
<footer><div class="wrap"><a href="/impressum/">Impressum</a><a href="/datenschutz/">Datenschutz</a><a href="/agb/">AGB &amp; Widerruf</a><a href="/blog/">Ratgeber</a>
<p>© {date.today().year} {e(b['name'])}{' · Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.' if b.get('small_business') else ''}</p></div></footer>
</body></html>"""


def _write(rel: str, content: str) -> None:
    p = DIST / rel.strip("/") / "index.html" if not rel.endswith(".xml") and not rel.endswith(".txt") else DIST / rel.strip("/")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")


def imprint_line(cfg: dict) -> str:
    b = cfg["business"]
    return f"{b['name']}, {b['owner']}, {b['street']}, {b['city']}, {b['email']}"


def build(cfg: dict, products: list[dict]) -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    b = cfg["business"]
    site = b["site_url"].rstrip("/")
    live = [p for p in products if p["status"] == "live" and p.get("payment_url")]
    urls = ["/", "/blog/", "/impressum/", "/datenschutz/", "/agb/"]

    # Startseite
    cards = "".join(
        f'<div class="card"><span class="tag">{"Web-Tool" if p["product_type"] == "webtool" else "Download"}</span>'
        f'<h3>{e(p["title"])}</h3><p>{e(p["copy"]["subheadline"])}</p>'
        f'<a class="btn" href="/p/{p["slug"]}/">{p["price_eur"]} € · Ansehen</a></div>'
        for p in sorted(live, key=lambda p: p.get("sales", 0), reverse=True)
    ) or "<p>Neue Produkte sind in Arbeit.</p>"
    _write("/", page(cfg, b["brand"], f'<section class="hero"><h1>{e(b["brand"])}</h1>'
                     f'<p>Praktische digitale Vorlagen, Leitfäden und Tools zum sofortigen Download.</p></section>'
                     f'<div class="grid">{cards}</div>', desc=f"{b['brand']}: digitale Vorlagen, Leitfäden und Tools."))

    blog_items = []
    for p in products:
        pdir = PRODUCTS / p["slug"]
        c = p["copy"]
        # Download-Seite: bleibt auch für ausgelistete Produkte erhalten, damit Käufer ihre Datei bekommen.
        if p.get("download_token") and (pdir / p["file"]).exists():
            ddir = DIST / "d" / p["download_token"]
            ddir.mkdir(parents=True, exist_ok=True)
            shutil.copy(pdir / p["file"], ddir / p["file"])
            _write(f"/d/{p['download_token']}/", page(cfg, f"Download: {p['title']}",
                   f'<section class="hero"><h1>Vielen Dank für Ihren Kauf!</h1><p>{e(p["title"])}</p>'
                   f'<p><a class="btn" href="{e(p["file"])}" download>Jetzt herunterladen</a></p>'
                   f'<p class="small">Bitte speichern Sie die Datei. Fragen? <a href="mailto:{e(b["email"])}">{e(b["email"])}</a></p></section>',
                   noindex=True, path=f"/d/{p['download_token']}/"))

        if p["status"] == "live" and p.get("payment_url"):
            bullets = "".join(f"<li>{e(x)}</li>" for x in c["bullets"])
            faq = "".join(f"<details><summary>{e(f['question'])}</summary><p>{e(f['answer'])}</p></details>" for f in c["faq"])
            body = (f'<section class="hero"><span class="tag">{"Web-Tool zum Download" if p["product_type"] == "webtool" else "Digitaler Download"}</span>'
                    f'<h1>{e(c["headline"])}</h1><p>{e(c["subheadline"])}</p>'
                    f'<div class="price">{p["price_eur"]} €</div><p class="small">Einmalzahlung · sofortiger Download · '
                    f'{"keine USt. gem. § 19 UStG" if b.get("small_business") else "inkl. gesetzl. USt."}</p>'
                    f'<a class="btn" href="{e(p["payment_url"])}" rel="nofollow">Jetzt kaufen</a></section>'
                    f'<article><ul class="check">{bullets}</ul>{markdown.markdown(c["description_markdown"], extensions=["tables"])}'
                    f'<h2>Häufige Fragen</h2>{faq}<p style="margin-top:2rem"><a class="btn" href="{e(p["payment_url"])}" rel="nofollow">Für {p["price_eur"]} € kaufen</a></p></article>')
            ld = {"@context": "https://schema.org", "@type": "Product", "name": p["title"], "description": c["meta_description"],
                  "offers": {"@type": "Offer", "price": str(p["price_eur"]), "priceCurrency": cfg["shop"]["currency"].upper(),
                             "availability": "https://schema.org/InStock", "url": f"{site}/p/{p['slug']}/"}}
            _write(f"/p/{p['slug']}/", page(cfg, f"{p['title']} · {b['brand']}", body, desc=c["meta_description"], path=f"/p/{p['slug']}/", jsonld=ld))
            urls.append(f"/p/{p['slug']}/")

        # Blogartikel bleiben dauerhaft online (Suchmaschinen-Traffic).
        cta = (f'<p><a class="btn" href="/p/{p["slug"]}/">Zum Produkt: {e(p["title"])}</a></p>'
               if p["status"] == "live" else "")
        _write(f"/blog/{p['slug']}/", page(cfg, c["blog_title"], f'<article><h1>{e(c["blog_title"])}</h1>'
               f'{markdown.markdown(c["blog_markdown"], extensions=["tables"])}{cta}</article>',
               desc=c["meta_description"], path=f"/blog/{p['slug']}/"))
        urls.append(f"/blog/{p['slug']}/")
        blog_items.append(f'<li><a href="/blog/{p["slug"]}/">{e(c["blog_title"])}</a></li>')

    _write("/blog/", page(cfg, f"Ratgeber · {b['brand']}", f'<section class="hero"><h1>Ratgeber</h1></section><ul>{"".join(blog_items)}</ul>', path="/blog/"))
    _legal_pages(cfg)
    _write("/sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
           + "".join(f"<url><loc>{site}{u}</loc></url>" for u in urls) + "</urlset>")
    _write("/robots.txt", f"User-agent: *\nDisallow: /d/\nSitemap: {site}/sitemap.xml\n")


def _legal_pages(cfg: dict) -> None:
    b = cfg["business"]
    contact = f"{e(b['owner'])}<br>{e(b['street'])}<br>{e(b['city'])}<br>{e(b['country'])}"
    vat = f"<p>Umsatzsteuer-ID gemäß § 27a UStG: {e(b['vat_id'])}</p>" if b.get("vat_id") else ""
    phone = f"<br>Telefon: {e(b['phone'])}" if b.get("phone") else ""
    _write("/impressum/", page(cfg, "Impressum", f"""<article><h1>Impressum</h1>
<p><strong>{e(b['name'])}</strong><br>{contact}</p><p>E-Mail: {e(b['email'])}{phone}</p>{vat}
<p>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV: {e(b['owner'])}, Anschrift wie oben.</p>
<p>Plattform der EU-Kommission zur Online-Streitbeilegung: Wir sind nicht bereit oder verpflichtet, an
Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
<p>Hinweis: Die Produkte in diesem Shop werden mit Unterstützung künstlicher Intelligenz erstellt.</p></article>""", path="/impressum/", noindex=True))

    _write("/datenschutz/", page(cfg, "Datenschutz", f"""<article><h1>Datenschutzerklärung</h1>
<h2>Verantwortlicher</h2><p>{e(b['name'])}, {contact}, {e(b['email'])}</p>
<h2>Hosting</h2><p>Diese Website wird bei Cloudflare, Inc. gehostet. Beim Aufruf werden technisch notwendige
Daten (z. B. IP-Adresse, Zeitpunkt, aufgerufene Seite) verarbeitet, um die Website auszuliefern und vor
Angriffen zu schützen (Art. 6 Abs. 1 lit. f DSGVO). Wir setzen keine Cookies und kein Tracking ein.</p>
<h2>Zahlungsabwicklung</h2><p>Käufe werden über Stripe Payments Europe Ltd., Irland, abgewickelt. Dabei verarbeitet
Stripe Name, E-Mail-Adresse, Zahlungs- und Rechnungsdaten zur Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)
und zur Erfüllung gesetzlicher Pflichten (lit. c). Es gilt zusätzlich die Datenschutzerklärung von Stripe:
<a href="https://stripe.com/de/privacy">stripe.com/de/privacy</a>.</p>
<h2>Web-Tools</h2><p>Unsere Web-Tools laufen ausschließlich in Ihrem Browser und übertragen keine Eingaben an uns.</p>
<h2>Ihre Rechte</h2><p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
Datenübertragbarkeit und Widerspruch sowie das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde.
Kontakt: {e(b['email'])}.</p></article>""", path="/datenschutz/", noindex=True))

    _write("/agb/", page(cfg, "AGB & Widerrufsbelehrung", f"""<article><h1>Allgemeine Geschäftsbedingungen</h1>
<h2>1. Geltungsbereich</h2><p>Diese AGB gelten für alle Käufe digitaler Produkte im Shop {e(b['brand'])}
von {e(b['name'])}, {e(b['street'])}, {e(b['city'])} (nachfolgend „Anbieter“).</p>
<h2>2. Vertragsschluss</h2><p>Die Darstellung der Produkte ist kein bindendes Angebot. Mit Klick auf „Bezahlen“ im
Bezahlvorgang geben Sie ein verbindliches Angebot ab; der Vertrag kommt mit erfolgreicher Zahlung zustande.</p>
<h2>3. Preise und Zahlung</h2><p>Es gelten die im Shop angegebenen Preise.{' Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.' if b.get('small_business') else ' Alle Preise enthalten die gesetzliche Umsatzsteuer.'}
Die Zahlung erfolgt über Stripe.</p>
<h2>4. Lieferung</h2><p>Nach der Zahlung erhalten Sie sofort einen Download-Link auf der Bestätigungsseite.</p>
<h2>5. Nutzungsrecht</h2><p>Sie erhalten ein einfaches, nicht übertragbares Recht zur persönlichen Nutzung.
Weitergabe, Weiterverkauf und Veröffentlichung sind nicht gestattet.</p>
<h2>6. Gewährleistung</h2><p>Es gelten die gesetzlichen Vorschriften. Die Inhalte ersetzen keine individuelle
Fachberatung.</p>
<h2 id="widerruf">7. Widerrufsbelehrung</h2><p><strong>Widerrufsrecht:</strong> Sie haben das Recht, binnen vierzehn Tagen ohne
Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des
Vertragsabschlusses. Um Ihr Widerrufsrecht auszuüben, müssen Sie uns ({e(b['name'])}, {e(b['street'])},
{e(b['city'])}, {e(b['email'])}) mittels einer eindeutigen Erklärung (z. B. E-Mail) über Ihren Entschluss,
diesen Vertrag zu widerrufen, informieren. Zur Wahrung der Frist reicht es aus, dass Sie die Mitteilung vor
Ablauf der Frist absenden.</p>
<p><strong>Folgen des Widerrufs:</strong> Wenn Sie diesen Vertrag widerrufen, zahlen wir Ihnen alle Zahlungen
unverzüglich und spätestens binnen vierzehn Tagen zurück, über dasselbe Zahlungsmittel.</p>
<p><strong>Vorzeitiges Erlöschen:</strong> Bei Verträgen über digitale Inhalte erlischt das Widerrufsrecht,
wenn wir mit der Vertragserfüllung begonnen haben, nachdem Sie ausdrücklich zugestimmt haben, dass wir vor
Ablauf der Widerrufsfrist mit der Ausführung beginnen, Sie Ihre Kenntnis davon bestätigt haben, dass Sie
dadurch Ihr Widerrufsrecht verlieren, und wir Ihnen eine Bestätigung zur Verfügung gestellt haben.</p>
<h3>Muster-Widerrufsformular</h3><p>An {e(b['name'])}, {e(b['street'])}, {e(b['city'])}, {e(b['email'])}:<br>
Hiermit widerrufe(n) ich/wir den von mir/uns abgeschlossenen Vertrag über den Kauf der folgenden digitalen
Inhalte: … / Bestellt am: … / Name: … / Anschrift: … / Datum: …</p></article>""", path="/agb/", noindex=True))
