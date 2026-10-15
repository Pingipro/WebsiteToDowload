// Pinguva – Startseite

// GoatCounter-Code (ohne Cookies). Leer = keine Statistik.
const GOATCOUNTER = "";

if (GOATCOUNTER) {
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://gc.zgo.at/count.js";
  script.dataset.goatcounter = `https://${GOATCOUNTER}.goatcounter.com/count`;
  document.body.appendChild(script);
}

// Navigation bekommt beim Scrollen einen Hintergrund
const nav = document.getElementById("nav");

function updateNav() {
  nav.classList.toggle("voll", scrollY > 20);
}

addEventListener("scroll", updateNav, { passive: true });
updateNav();

// Abschnitte blenden ein, sobald sie sichtbar werden
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("da");
      revealObserver.unobserve(entry.target);
    }
  },
  { threshold: 0.15 },
);

document.querySelectorAll(".rein").forEach((el, i) => {
  el.style.transitionDelay = `${(i % 6) * 70}ms`;
  revealObserver.observe(el);
});

// Manifest: Wörter werden beim Scrollen nacheinander hell
const manifest = document.getElementById("manifest");
manifest.innerHTML = manifest.textContent
  .split(" ")
  .map((word) => `<span>${word}</span>`)
  .join(" ");
const words = manifest.querySelectorAll("span");

function updateManifest() {
  const box = manifest.getBoundingClientRect();
  const progress = (innerHeight * 0.85 - box.top) / (box.height + innerHeight * 0.4);
  const visible = Math.round(Math.min(1, Math.max(0, progress)) * words.length);
  words.forEach((word, i) => word.classList.toggle("an", i < visible));
}

addEventListener("scroll", updateManifest, { passive: true });
updateManifest();

// Beispielanruf: Nachrichten erscheinen nacheinander
const chat = document.getElementById("blasen");
const bubbles = chat.querySelectorAll(".blase");

const chatObserver = new IntersectionObserver(
  ([entry]) => {
    if (!entry.isIntersecting) return;
    chatObserver.disconnect();
    bubbles.forEach((bubble, i) => {
      setTimeout(() => bubble.classList.add("da"), 300 + i * 900);
    });
  },
  { threshold: 0.4 },
);

chatObserver.observe(chat);
