# Cloth Studio – 3D-Schnittkonstruktion & Echtzeit-Textilsimulation

Single-Page-Application im Stil von CLO3D: links ein 2D-Schnittmuster-Editor, rechts ein
3D-Viewport mit Avatar und Echtzeit-Stoffsimulation, dazu ein Inspektor für Stoffe, Teile,
Nähte und Physik.

**Stack:** React 19 · TypeScript · Tailwind CSS 4 · Vite · Three.js / `@react-three/fiber` /
`@react-three/drei` · Zustand (+ Immer) · `@dimforge/rapier3d-compat` · `delaunator` · `earcut`

## Schnellstart

```bash
cd cloth-studio
npm install
npm run dev        # Entwicklungsserver
npm run build      # Produktionsbuild nach dist/ (relativer base-Pfad → in jedem Unterordner hostbar)
npm test           # Unit- und Simulationstests (Vitest)
```

## Funktionen

| Bereich | Umsetzung |
| --- | --- |
| Layout | Verschiebbares Split-Pane (2D ↔ 3D, Doppelklick setzt zurück), Inspektor rechts, Statusleiste |
| 2D-Editor (SVG) | Auswahl/Verschieben (V), Punkt einfügen (P, inkl. Bezier-Teilung), Kurve umschalten (C), Bezier-Anfasser, Naht-Werkzeug (S, Shift+Klick erweitert Kantenzug), neues Teil zeichnen (D), Pan (H/Mittelklick), Zoom (Mausrad), Einpassen (F), Löschen (Entf), Kantenlängen beim Überfahren, Triangulierungs-Overlay |
| Triangulierung | Bogenlängen-Abtastung des Umrisses + hexagonales Innengitter → `delaunator`, Filter für konkave Bereiche; alternativ `earcut` (nur Umriss) |
| Synchronisation | Auswahl/Hover im 2D-Editor, in der Teileliste und im 3D-Viewport sind gekoppelt; Geometrieänderungen bauen die Simulation entprellt neu auf |
| Avatar | Parametrischer Mannequin aus Round-Cones, glatt per SDF-Smooth-Union + Surface Nets polygonisiert; Größe/Umfang einstellbar |
| Physik | XPBD-Solver ("Small Steps"): Dehnung, Biegung, Nähte, Selbstkollision (Spatial Hash), Avatar-Kollision mit Reibung, Boden, Aerodynamik/Wind mit Turbulenz |
| Kollision | Umschaltbar: SDF (glatt, schnell) oder **Rapier 3D** (statischer Rigid Body mit konvexen Kollidern, `projectPoint`-Abfragen); beide mit Breitphase pro Frame |
| Nähen | Nahtpartikel werden über die Bogenlänge gepaart; Ruhelänge schrumpft mit einstellbarer Geschwindigkeit; Nähphase mit reibungsfreiem Gleiten und ohne Schwerkraft, bis die Nähte geschlossen sind |
| Materialien | Stoffbibliothek (Jersey, Denim, Seide, Leinen, Wolle, Elasthan): Gewicht, Dehn-/Biegesteifigkeit, Dämpfung, Reibung, Dicke, Farbe, prozedurale Texturen, Sheen – live mit der Simulation verbunden |
| Interaktion 3D | Orbit-Kamera, Kamera-Presets, Stoff greifen & ziehen (Hand-Modus), Wind an/aus, Pause (Leertaste), Reset (R) |
| Projekt | Vorlagen T-Shirt / Rock / Hose, JSON-Export/-Import |

## Architektur

```
src/
├── types/                 Domänentypen (Schnittteile, Nähte, Stoffe, Einstellungen)
├── store/                 Zustand-Store (einzige Quelle der Wahrheit für 2D, Nähte, Stoffe, UI)
├── geometry/              Bezier, Umriss-Abtastung, Triangulierung, 2D→3D-Platzierung, Naht-Hilfen
├── patterns/              Schnittmuster-Vorlagen
├── avatar/                Avatar-Modell, SDF, Surface-Nets-Mesher
├── materials/             Stoff-Presets und prozedurale Texturen
├── physics/
│   ├── ParticleState.ts       Struktur-of-Arrays für alle Partikel
│   ├── buildCloth.ts          Pattern-Meshes → Partikel, Dehn-/Biege-/Nahtbedingungen
│   ├── ClothSolver.ts         XPBD-Substep-Schleife, Aerodynamik, Greifen
│   ├── constraints/           SolverConstraint-Interface, Distanz- & Selbstkollisions-Bedingungen
│   ├── colliders/             ColliderBackend-Interface, SDF- und Rapier-Backend
│   ├── materialMapping.ts     UI-Parameter → physikalische Compliance/Masse/Dicke
│   ├── SimulationController.ts Brücke Store ↔ Solver (Neuaufbau, Live-Updates, Backend-Wechsel)
│   └── useSimulationSync.ts   React-Hook für die Synchronisation
└── components/            layout/, editor2d/, viewport3d/, inspector/
```

### Erweiterung der Physik

- **Neue Bedingung** (z. B. Pins, Knöpfe, Anisotropie): `SolverConstraint` implementieren und in
  `ClothSolver.extraConstraints` registrieren – `prepare()` läuft einmal pro Frame, `solve()` in jedem Substep.
- **Neues Kollisions-Backend** (z. B. GLTF-Avatar als Rapier-Trimesh): `ColliderBackend` implementieren
  (`prepare`/`collide`/`dispose`) und in `SimulationController.setBackend` anmelden.
- **Neue Stoffparameter**: Feld in `Fabric` ergänzen, in `materialMapping.ts` abbilden und in
  `ClothSolver.setPieceFabric` auf Partikel/Bedingungen übertragen.

## Debugging

In der Browser-Konsole ist `window.studio` verfügbar (`simulation`, `store`), z. B.
`studio.simulation.solver.stats` oder `studio.store.getState().loadPreset('trousers')`.
