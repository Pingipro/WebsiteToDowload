// Startseite

// Wohin die Anmeldungen der Warteliste gehen, z. B. "https://formspree.io/f/xxxx".
// Leer = es wird nichts gespeichert (die Seite sagt das dann auch).
const WARTELISTE_URL = "";

// GoatCounter-Code (ohne Cookies). Leer = keine Statistik.
const GOATCOUNTER = "";

const ANIM = document.documentElement.classList.contains("anim");

if (GOATCOUNTER) {
  const sc = document.createElement("script");
  sc.async = true;
  sc.src = "https://gc.zgo.at/count.js";
  sc.dataset.goatcounter = "https://" + GOATCOUNTER + ".goatcounter.com/count";
  document.body.appendChild(sc);
}

function zaehle(name) {
  try { window.goatcounter?.count?.({ path: name, title: name, event: true }); } catch (e) {}
}

// Warteliste
(function () {
  const form = document.getElementById("wlForm");
  const mail = document.getElementById("wl-mail");
  const early = document.getElementById("wl-early");
  const btn = document.getElementById("wlButton");
  const msg = document.getElementById("wlMsg");
  const done = document.getElementById("wlDone");
  const box = document.getElementById("wlBox");
  const figur = box.querySelector(".mascot");
  const gueltig = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  mail.addEventListener("input", () => {
    if (mail.getAttribute("aria-invalid") === "true" && gueltig(mail.value.trim())) {
      mail.removeAttribute("aria-invalid");
      msg.textContent = "";
      msg.classList.remove("fehler");
    }
  });

  function fehler(text, feld) {
    msg.textContent = text;
    msg.classList.add("fehler");
    if (!feld) return;
    feld.setAttribute("aria-invalid", "true");
    feld.focus();
    const f = feld.closest(".field");
    f.classList.remove("wackeln");
    void f.offsetWidth;
    f.classList.add("wackeln");
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    msg.textContent = "";
    msg.classList.remove("fehler");
    if (form._gotcha.value) return; // Bot
    if (!gueltig(mail.value.trim())) return fehler("Bitte geben Sie eine gültige E-Mail-Adresse ein.", mail);
    if (!WARTELISTE_URL) {
      console.warn("WARTELISTE_URL ist leer, nichts gespeichert");
      return fehler("Die Anmeldung ist noch nicht freigeschaltet. Bitte versuchen Sie es in ein paar Tagen wieder.");
    }

    btn.setAttribute("aria-busy", "true");
    btn.querySelector("span").textContent = "Wird eingetragen …";
    try {
      const r = await fetch(WARTELISTE_URL, { method: "POST", headers: { Accept: "application/json" }, body: new FormData(form) });
      if (!r.ok) throw new Error(r.status);
      form.hidden = true;
      if (early.checked) document.getElementById("wlDoneText").textContent = "Für den Early Access melden wir uns per E-Mail bei Ihnen.";
      done.hidden = false;
      done.focus();
      zaehle(early.checked ? "warteliste-early-access" : "warteliste");
      box.classList.add("erfolg");
      figur._winken?.();
    } catch (err) {
      fehler("Das hat nicht geklappt. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es nochmals.");
    } finally {
      btn.removeAttribute("aria-busy");
      btn.querySelector("span").textContent = "Warteliste beitreten";
    }
  });
})();

// Menü auf dem Handy, Logo führt nach oben
(function () {
  const top = document.getElementById("top");
  const knopf = top.querySelector(".menu-btn");
  const setze = offen => {
    top.classList.toggle("offen", offen);
    knopf.setAttribute("aria-expanded", offen);
  };
  knopf.addEventListener("click", () => setze(!top.classList.contains("offen")));
  top.querySelectorAll("a.link").forEach(a => a.addEventListener("click", () => setze(false)));
  addEventListener("keydown", e => { if (e.key === "Escape") setze(false); });

  document.querySelectorAll('a.brand[href="#top"]').forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    setze(false);
    scrollTo({ top: 0, behavior: ANIM ? "smooth" : "auto" });
    history.replaceState(null, "", location.pathname);
  }));
})();

// Gespräch im Handy oben läuft Zeile für Zeile ab, immer wieder
(function () {
  const seq = document.getElementById("heroSeq");
  if (!seq || !ANIM) return;
  const figur = seq.closest(".hero-stage").querySelector(".mascot-hero");
  const teile = [...seq.children];
  const typing = seq.querySelector(".typing");
  let timer = [];
  const spaeter = (fn, ms) => timer.push(setTimeout(fn, ms));

  function lauf() {
    timer.forEach(clearTimeout);
    timer = [];
    seq.classList.add("playing");
    teile.forEach(el => el.classList.remove("in", "weg"));
    let t = 500;
    for (const el of teile) {
      spaeter(() => {
        el.classList.add("in");
        if (el.classList.contains("pv")) {
          typing.classList.add("weg");
          figur.classList.add("spricht");
          spaeter(() => figur.classList.remove("spricht"), 2200);
        }
      }, t);
      if (el.classList.contains("typing")) t += 1300;
      else if (el.classList.contains("who")) t += 220;
      else if (el.classList.contains("pv")) t += 1500;
      else t += 800;
    }
    spaeter(() => {
      seq.classList.add("aus");
      spaeter(() => { seq.classList.remove("aus"); lauf(); }, 450);
    }, t + 5000);
  }
  lauf();
})();

// Handy kippt leicht zur Maus
(function () {
  if (!ANIM || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const stage = document.querySelector(".hero-stage");
  const phone = stage.querySelector(".phone");
  stage.addEventListener("pointermove", e => {
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5;
    const y = (e.clientY - r.top) / r.height - .5;
    phone.style.transform = `perspective(1000px) rotateY(${x * 10}deg) rotateX(${-y * 8}deg)`;
  });
  stage.addEventListener("pointerleave", () => { phone.style.transform = ""; });
})();

// Einblenden beim Scrollen
(function () {
  if (!ANIM) return;
  document.querySelectorAll(".flow").forEach(f => f.querySelectorAll("li").forEach((li, i) => li.style.setProperty("--i", i)));
  document.querySelectorAll("[data-stagger]").forEach(box =>
    [...box.children].forEach((el, i) => el.style.setProperty("--d", (i % 6) * 90 + "ms")));
  const ziele = document.querySelectorAll(".rv, .flow, .local");
  if (!("IntersectionObserver" in window)) {
    ziele.forEach(el => el.classList.add("in-view"));
    return;
  }
  const io = new IntersectionObserver(eintraege => eintraege.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add("in-view");
    io.unobserve(en.target);
  }), { rootMargin: "0px 0px -10% 0px", threshold: .12 });
  ziele.forEach(el => io.observe(el));
})();

// Pfeiltasten zwischen Tabs oder Radio-Knöpfen
function pfeiltasten(liste, waehle) {
  liste.forEach((el, i) => {
    el.addEventListener("click", () => waehle(el));
    el.addEventListener("keydown", e => {
      let n = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") n = liste[(i + 1) % liste.length];
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = liste[(i - 1 + liste.length) % liste.length];
      if (!n) return;
      e.preventDefault();
      waehle(n);
      n.focus();
    });
  });
}

// App-Vorschau: Tabs
(function () {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  pfeiltasten(tabs, tab => {
    for (const t of tabs) {
      const an = t === tab;
      t.setAttribute("aria-selected", an);
      t.tabIndex = an ? 0 : -1;
      const p = document.getElementById(t.getAttribute("aria-controls"));
      p.hidden = !an;
      p.style.display = an ? "flex" : "none";
    }
  });
})();

// KI-Chat: Modell wählen (nur Beispiel)
(function () {
  const knoepfe = [...document.querySelectorAll(".modelle [role=radio]")];
  if (!knoepfe.length) return;
  const status = document.getElementById("modellStatus");
  const antwort = document.getElementById("modellAntwort");
  const icon = pfad => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pfad}</svg>`;
  const OK = icon('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 9.5"/>');
  const WOLKE = icon('<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>');
  const text = "Gerne, hier ein Vorschlag: „Liebe Kundschaft, vom 21. Dezember bis 4. Januar bleibt unser Betrieb geschlossen …“";

  function waehle(k) {
    for (const b of knoepfe) {
      const an = b === k;
      b.setAttribute("aria-checked", an);
      b.tabIndex = an ? 0 : -1;
    }
    const m = k.dataset.modell;
    const lokal = m === "lokal";
    status.classList.toggle("cloud-an", !lokal);
    status.innerHTML = lokal
      ? OK + "<span>Läuft auf Ihrem Rechner. Geeignet für alle Daten.</span>"
      : WOLKE + `<span>${m} läuft in der Cloud. Nur für allgemeine Fragen und Texte ohne Kundendaten.</span>`;
    antwort.innerHTML = `<small>${lokal ? "Lokale KI" : m}</small>${text}`;
    antwort.classList.remove("neu");
    void antwort.offsetWidth;
    antwort.classList.add("neu");
  }
  pfeiltasten(knoepfe, waehle);
  waehle(knoepfe[0]);
})();

document.getElementById("jahr").textContent = new Date().getFullYear();
