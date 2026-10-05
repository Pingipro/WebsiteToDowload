import { useSyncExternalStore } from 'react';
import { simulation } from '../../physics/SimulationController';
import { useStudioStore } from '../../store/useStudioStore';
import { Section, Select, Slider, Toggle } from './controls';

/** Physik-, Wind-, Ansichts- und Avatar-Einstellungen. */
export function SimulationPanel() {
  const sim = useStudioStore((s) => s.sim);
  const view = useStudioStore((s) => s.view);
  const avatar = useStudioStore((s) => s.avatar);
  const { setSim, setView, setAvatar } = useStudioStore.getState();
  useSyncExternalStore(simulation.subscribe, simulation.getVersion);
  const status = simulation.backendStatus;

  return (
    <>
      <Section title="Solver (XPBD)">
        <Slider label="Schwerkraft" value={sim.gravity} min={0} max={20} step={0.1} unit="m/s²" digits={1} onChange={(v) => setSim({ gravity: v })} />
        <Slider label="Substeps pro Frame" value={sim.substeps} min={2} max={30} step={1} digits={0} onChange={(v) => setSim({ substeps: v })} hint="Mehr Substeps = steifer & stabiler, aber langsamer" />
        <Toggle label="Selbstkollision" checked={sim.selfCollision} onChange={(v) => setSim({ selfCollision: v })} hint="Stofflagen durchdringen sich nicht (Spatial Hash)" />
        <Select
          label="Avatar-Kollision"
          value={sim.colliderBackend}
          options={[
            { value: 'sdf', label: 'SDF (glatt, schnell)' },
            { value: 'rapier', label: 'Rapier 3D (WASM Rigid Bodies)' },
          ]}
          onChange={(v) => setSim({ colliderBackend: v })}
        />
        <p className={`text-[11px] ${status.state === 'error' ? 'text-red-400' : status.state === 'loading' ? 'text-amber-300' : 'text-zinc-500'}`}>
          {status.state === 'loading'
            ? 'Rapier-WASM wird geladen …'
            : status.state === 'error'
              ? status.message
              : status.kind === 'rapier'
                ? 'Aktiv: Rapier – konvexe Kollider, Point-Projection-Abfragen.'
                : 'Aktiv: Signed-Distance-Field mit Smooth-Union der Körperteile.'}
        </p>
      </Section>

      <Section title="Nähen">
        <Slider label="Nähgeschwindigkeit" value={sim.seamSpeed} min={0.05} max={2} step={0.05} unit="m/s" onChange={(v) => setSim({ seamSpeed: v })} hint="Wie schnell die Nahtkanten zusammengezogen werden" />
        <Slider label="Nahtfestigkeit" value={sim.seamStiffness} min={0} max={1} onChange={(v) => setSim({ seamStiffness: v })} />
      </Section>

      <Section title="Wind">
        <Toggle label="Wind aktiv" checked={sim.windEnabled} onChange={(v) => setSim({ windEnabled: v })} />
        <Slider label="Stärke" value={sim.windStrength} min={0} max={15} step={0.1} unit="m/s" digits={1} onChange={(v) => setSim({ windStrength: v })} />
        <Slider label="Richtung" value={sim.windDirection} min={0} max={360} step={1} unit="°" digits={0} onChange={(v) => setSim({ windDirection: v })} />
        <Slider label="Turbulenz" value={sim.windTurbulence} min={0} max={1.5} onChange={(v) => setSim({ windTurbulence: v })} />
      </Section>

      <Section title="Triangulierung">
        <Select
          label="Verfahren"
          value={sim.triangulation}
          options={[
            { value: 'delaunay', label: 'Delaunay + Innengitter' },
            { value: 'earcut', label: 'Earcut (nur Umriss)' },
          ]}
          onChange={(v) => setSim({ triangulation: v })}
        />
        <Slider label="Partikelabstand" value={sim.resolution} min={1.2} max={6} step={0.1} unit="cm" digits={1} onChange={(v) => setSim({ resolution: v })} hint="Feiner = mehr Details/Falten, aber langsamer" />
      </Section>

      <Section title="Avatar">
        <Slider label="Körpergröße" value={avatar.height} min={1.5} max={2.0} step={0.01} unit="m" onChange={(v) => setAvatar({ height: v })} />
        <Slider label="Umfang" value={avatar.girth} min={0.8} max={1.3} step={0.01} unit="×" onChange={(v) => setAvatar({ girth: v })} />
        <label className="flex items-center justify-between text-xs">
          <span className="text-zinc-300">Hautton</span>
          <input type="color" value={avatar.skinColor} onChange={(e) => setAvatar({ skinColor: e.target.value })} className="h-7 w-10 cursor-pointer rounded border border-zinc-700 bg-transparent" />
        </label>
      </Section>

      <Section title="Ansicht">
        <Toggle label="Avatar anzeigen" checked={view.showAvatar} onChange={(v) => setView({ showAvatar: v })} />
        <Toggle label="Kollisionskörper anzeigen" checked={view.showColliders} onChange={(v) => setView({ showColliders: v })} />
        <Toggle label="Nahtlinien (3D)" checked={view.showSeams3D} onChange={(v) => setView({ showSeams3D: v })} />
        <Toggle label="Drahtgitter" checked={view.showWireframe} onChange={(v) => setView({ showWireframe: v })} />
        <Toggle label="Triangulierung (2D)" checked={view.showMesh2D} onChange={(v) => setView({ showMesh2D: v })} />
      </Section>
    </>
  );
}
