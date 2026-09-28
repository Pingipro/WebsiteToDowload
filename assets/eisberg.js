// Pinguin auf dem Eisberg: erledigt was, rutscht runter, platsch, "Easy work with Pinguva", von vorn.
// <div class="eisberg" data-eisberg></div>
(function(){
  const NS = "http://www.w3.org/2000/svg";
  const RUHIG = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AUFGABEN = ["Anruf angenommen", "Termin gebucht", "E-Mail vorbereitet"];
  const SPITZE = [120, 117]; // Füsse auf der Spitze

  const PINGU = `
    <ellipse cx="76" cy="212" rx="22" ry="9" fill="#FF9A3C"/>
    <ellipse cx="124" cy="212" rx="22" ry="9" fill="#FF9A3C"/>
    <path d="M100 22C150 22 176 72 176 127C176 182 145 210 100 210C55 210 24 182 24 127C24 72 50 22 100 22Z" fill="#3D50E8"/>
    <ellipse cx="26" cy="140" rx="12" ry="30" transform="rotate(18 26 140)" fill="#2A37AE"/>
    <g class="fluegel-r"><ellipse cx="174" cy="140" rx="12" ry="30" transform="rotate(-18 174 140)" fill="#2A37AE"/></g>
    <path d="M100 116C130 116 148 136 148 160C148 184 128 200 100 200C92 200 84 199 77 196L60 204L66 189C56 180 52 170 52 160C52 136 70 116 100 116Z" fill="#F4F7FF"/>
    <ellipse cx="100" cy="86" rx="46" ry="33" fill="#FFFFFF"/>
    <g class="augen"><g class="blick">
      <circle cx="83" cy="83" r="7.5" fill="#16204A"/><circle cx="117" cy="83" r="7.5" fill="#16204A"/>
      <circle cx="85.5" cy="80.5" r="2.4" fill="#fff"/><circle cx="119.5" cy="80.5" r="2.4" fill="#fff"/>
    </g></g>
    <ellipse cx="70" cy="98" rx="7" ry="4" fill="#FF8FA8" opacity=".55"/>
    <ellipse cx="130" cy="98" rx="7" ry="4" fill="#FF8FA8" opacity=".55"/>
    <path d="M91 96Q100 91 109 96Q100 110 91 96Z" fill="#FF9A3C"/>
    <path d="M40 76C40 18 160 18 160 76" fill="none" stroke="#22C29A" stroke-width="9" stroke-linecap="round"/>
    <rect x="28" y="64" width="20" height="32" rx="9" fill="#22C29A"/>
    <rect x="152" y="64" width="20" height="32" rx="9" fill="#22C29A"/>
    <path d="M38 94C38 116 52 124 70 121" fill="none" stroke="#1BA784" stroke-width="5" stroke-linecap="round"/>
    <circle cx="73" cy="120.5" r="6" fill="#16204A"/>
    <g class="wellen" opacity="0" fill="none" stroke="#22C29A" stroke-width="3.5" stroke-linecap="round"><path class="w1" d="M84 114q5 6.5 0 13"/><path class="w2" d="M92 109q9 11.5 0 23"/></g>
    <path d="M92 26Q98 12 106 20Q110 10 116 18" fill="none" stroke="#2A37AE" stroke-width="5" stroke-linecap="round"/>`;

  const WELLE = "M0 0q30 -8 60 0t60 0t60 0t60 0t60 0t60 0V120H0Z";

  function szene(id){
    return `
    <svg viewBox="0 0 240 280" xmlns="${NS}">
      <defs>
        <clipPath id="${id}k"><circle cx="120" cy="160" r="112"/></clipPath>
        <radialGradient id="${id}h" cx="72%" cy="22%" r="85%">
          <stop offset="0" stop-color="#D6EFFA"/><stop offset=".45" stop-color="#5DB4DE"/><stop offset="1" stop-color="#1D5E97"/>
        </radialGradient>
        <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#1B9EC2"/><stop offset="1" stop-color="#0A3E68"/>
        </linearGradient>
        <linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#1F6FA8"/><stop offset="1" stop-color="#0A3563"/>
        </linearGradient>
      </defs>
      <g clip-path="url(#${id}k)">
        <rect x="0" y="40" width="240" height="240" fill="url(#${id}h)"/>
        <g transform="translate(0 176)"><path class="eb-see2" d="${WELLE}" fill="#3FA9D0" opacity=".65"/></g>
        <path d="M52 212L84 152L100 162L115 116H125L150 142L160 134L192 212Z" fill="#F0F8FE" stroke="#0B4A78" stroke-width="5" stroke-linejoin="round"/>
        <path d="M125 116L150 142L160 134L192 212H136Z" fill="#A6DAF3"/>
        <path d="M52 212L84 152L100 162L115 116H125L150 142L160 134L192 212" fill="none" stroke="#0B4A78" stroke-width="5" stroke-linejoin="round"/>
        <g class="eb-reiter"><g transform="translate(-21 -46.4) scale(.21)">${PINGU}</g></g>
        <g transform="translate(0 190)"><path class="eb-see" d="${WELLE}" fill="url(#${id}s)"/></g>
        <g class="eb-spritzer"></g>
        <ellipse cx="160" cy="70" rx="70" ry="44" fill="#fff" opacity=".12"/>
      </g>
      <circle cx="120" cy="160" r="112" fill="none" stroke="#8FA6B8" stroke-width="5"/>
      <g class="eb-karte">
        <circle cx="120" cy="160" r="114.5" fill="url(#${id}c)"/>
        <circle cx="120" cy="160" r="112" fill="none" stroke="#8FA6B8" stroke-width="5"/>
        <path d="M96 118L111 88L119 94L128 76L144 118" fill="none" stroke="#A6DAF3" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
        <text x="120" y="160" text-anchor="middle" font-family="ui-rounded,'Segoe UI Variable Display','Segoe UI',system-ui,sans-serif" font-weight="800" font-size="30" fill="#fff" letter-spacing="-.5">Easy work</text>
        <text x="120" y="190" text-anchor="middle" font-family="ui-rounded,'Segoe UI Variable Display','Segoe UI',system-ui,sans-serif" font-weight="600" font-size="20" fill="#A6DAF3">with Pinguva</text>
      </g>
      <g class="eb-blase">
        <rect x="30" y="6" width="180" height="36" rx="18" fill="#fff" stroke="#D3DEFF" stroke-width="1.5"/>
        <path d="M112 41L120 54L128 41Z" fill="#fff"/>
        <circle cx="50" cy="24" r="10" fill="#22C29A"/>
        <path d="M45.5 24.3l3 3 6-6.2" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        <text class="eb-text" x="67" y="29" font-family="system-ui,'Segoe UI',sans-serif" font-weight="700" font-size="14" fill="#16204A"></text>
      </g>
    </svg>`;
  }

  const pos = (x, y, a = 0) => `translate(${x}px, ${y}px) rotate(${a}deg)`;
  const pause = ms => new Promise(r => setTimeout(r, ms));

  // [x, y, Winkel, Zeitpunkt]
  const WEGE = [
    { name: "rechts", dauer: 1500, spritzer: [198, 192], weg: [
      [120,117,0,0],[124,117,-28,.12],[150,141,-45,.42],[160,129,-30,.55],[176,160,-48,.72],[198,206,-55,1]] },
    { name: "links", dauer: 1650, spritzer: [44, 192], weg: [
      [120,117,0,0],[116,117,28,.12],[101,159,42,.42],[86,148,22,.6],[64,146,8,.78],[44,206,38,1]] },
    { name: "kopfsprung", dauer: 1300, spritzer: [176, 192], weg: [
      [120,117,0,0],[124,121,0,.1],[134,86,70,.4],[152,96,150,.62],[176,212,180,1]] }
  ];

  let zaehler = 0;

  function montiere(el){
    const id = "eb" + (++zaehler);
    el.innerHTML = szene(id);
    const svg = el.querySelector("svg");
    const reiter = svg.querySelector(".eb-reiter");
    const blase = svg.querySelector(".eb-blase");
    const text = svg.querySelector(".eb-text");
    const karte = svg.querySelector(".eb-karte");
    const spritzer = svg.querySelector(".eb-spritzer");
    reiter.style.transform = pos(...SPITZE);
    karte.style.transformOrigin = "120px 160px";
    let aufSpitze = true;

    const winken = () => {
      if (!aufSpitze || el.classList.contains("eb-winkt")) return;
      el.classList.add("eb-winkt");
      setTimeout(() => el.classList.remove("eb-winkt"), 2100);
    };
    el.addEventListener("click", winken);
    el.addEventListener("mouseenter", winken);
    el._winken = winken;

    // Augen schauen dem Zeiger nach
    addEventListener("pointermove", e => {
      const r = reiter.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * .35);
      const d = Math.hypot(dx, dy) || 1, f = Math.min(d / 200, 1);
      el.style.setProperty("--bx", (dx / d * 5.5 * f).toFixed(2) + "px");
      el.style.setProperty("--by", (dy / d * 4 * f).toFixed(2) + "px");
    }, { passive: true });

    text.textContent = AUFGABEN[1];
    if (RUHIG) { blase.style.opacity = 1; return; }

    // pausieren, wenn nicht sichtbar
    let sichtbar = false, wecker = null;
    const aufwachen = () => { if (sichtbar && !document.hidden && wecker) { wecker(); wecker = null; } };
    new IntersectionObserver(([e]) => { sichtbar = e.isIntersecting; aufwachen(); }).observe(el);
    document.addEventListener("visibilitychange", aufwachen);
    const bereit = () => (sichtbar && !document.hidden) ? Promise.resolve() : new Promise(r => { wecker = r; });

    const bewege = (elem, frames, opt) => elem.animate(frames, { fill: "forwards", ...opt }).finished;

    function platsch(x, y){
      const tropfen = [];
      for (let i = 0; i < 8; i++) {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("r", (2 + Math.random() * 2.2).toFixed(1));
        c.setAttribute("fill", i % 3 ? "#E8F7FF" : "#9FDDF2");
        spritzer.appendChild(c);
        const dx = (i - 3.5) * 7 + (Math.random() * 6 - 3), h = 26 + Math.random() * 26;
        tropfen.push(bewege(c, [
          { transform: `translate(${x}px, ${y}px) scale(.4)`, opacity: 1 },
          { transform: `translate(${x + dx * .6}px, ${y - h}px) scale(1)`, opacity: 1, offset: .45 },
          { transform: `translate(${x + dx}px, ${y + 14}px) scale(.8)`, opacity: 0 }
        ], { duration: 750 + Math.random() * 250, easing: "cubic-bezier(.2,.6,.4,1)" }).then(() => c.remove()));
      }
      for (let i = 0; i < 2; i++) {
        const k = document.createElementNS(NS, "ellipse");
        k.setAttribute("rx", 14); k.setAttribute("ry", 3.5);
        k.setAttribute("fill", "none"); k.setAttribute("stroke", "#E8F7FF"); k.setAttribute("stroke-width", 2);
        spritzer.appendChild(k);
        tropfen.push(bewege(k, [
          { transform: `translate(${x}px, ${y + 4}px) scale(.2)`, opacity: .9 },
          { transform: `translate(${x}px, ${y + 4}px) scale(${1.8 + i})`, opacity: 0 }
        ], { duration: 900, delay: i * 180, easing: "ease-out" }).then(() => k.remove()));
      }
      return Promise.all(tropfen);
    }

    async function lauf(start){
      let n = start;
      await bereit();
      await pause(700);
      for (;;) {
        const weg = WEGE[n % WEGE.length];
        // Sprechblase
        await bereit();
        text.textContent = AUFGABEN[n % AUFGABEN.length];
        el.classList.add("eb-redet");
        await bewege(blase, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 350, easing: "ease-out" });
        await pause(1900);
        el.classList.remove("eb-redet");
        winken();
        await pause(900);
        bewege(blase, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
        await pause(250);
        // runterrutschen
        aufSpitze = false;
        el.classList.remove("eb-winkt");
        await bewege(reiter, weg.weg.map(([x, y, a, o]) => ({ transform: pos(x, y, a), offset: o })),
          { duration: weg.dauer, easing: "cubic-bezier(.45,.05,.8,.6)" });
        // platsch
        const [sx, sy] = weg.spritzer;
        const [lx, ly, la] = weg.weg[weg.weg.length - 1];
        bewege(reiter, [{ transform: pos(lx, ly, la) }, { transform: pos(lx, ly + 40, la) }], { duration: 300, easing: "ease-in" });
        await platsch(sx, sy);
        await pause(250);
        // Karte
        await bereit();
        await bewege(karte, [{ opacity: 0, transform: "scale(.92)" }, { opacity: 1, transform: "scale(1)" }], { duration: 450, easing: "cubic-bezier(.23,1,.32,1)" });
        await pause(2300);
        reiter.getAnimations().forEach(a => a.cancel());
        reiter.style.transform = pos(58, 240);
        await bewege(karte, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: "ease-in" });
        // links auftauchen und zurück nach oben
        await bewege(reiter, [{ transform: pos(58, 240) }, { transform: pos(58, 202) }], { duration: 450, easing: "ease-out" });
        await pause(350);
        await bewege(reiter, [
          { transform: pos(58, 202, 0) },
          { transform: pos(84, 92, 8), offset: .55 },
          { transform: pos(120, 111, 0), offset: .85 },
          { transform: pos(...SPITZE, 0) }
        ], { duration: 800, easing: "cubic-bezier(.3,.7,.4,1)" });
        reiter.getAnimations().forEach(a => a.cancel());
        reiter.style.transform = pos(...SPITZE);
        aufSpitze = true;
        n++;
      }
    }
    lauf(zaehler - 1);
  }

  const los = () => document.querySelectorAll("[data-eisberg]").forEach(montiere);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", los); else los();
})();
