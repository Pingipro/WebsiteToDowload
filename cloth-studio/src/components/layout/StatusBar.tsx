import { useEffect, useState } from 'react';
import { simulation } from '../../physics/SimulationController';
import { useStudioStore } from '../../store/useStudioStore';

/** Fußzeile mit Live-Statistiken der Simulation (Polling, um React nicht pro Frame zu rendern). */
export function StatusBar() {
  const [, force] = useState(0);
  const running = useStudioStore((s) => s.sim.running);
  const backend = useStudioStore((s) => s.sim.colliderBackend);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = () => {
      frames++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const id = setInterval(() => {
      const now = performance.now();
      setFps((frames * 1000) / (now - last));
      frames = 0;
      last = now;
      force((x) => x + 1);
    }, 500);
    return () => {
      clearInterval(id);
      cancelAnimationFrame(raf);
    };
  }, []);

  const st = simulation.solver?.stats;
  const progress = st ? Math.round(st.seamProgress * 100) : 0;
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-zinc-800 bg-zinc-900 px-3 font-mono text-[11px] text-zinc-500">
      <span className={running ? 'text-emerald-400' : 'text-zinc-400'}>● {running ? 'läuft' : 'pausiert'}</span>
      {st && (
        <>
          <span>{st.particles.toLocaleString('de-DE')} Partikel</span>
          <span>{st.triangles.toLocaleString('de-DE')} Dreiecke</span>
          <span>
            {(st.stretch + st.bend).toLocaleString('de-DE')} Bedingungen · {st.seams.toLocaleString('de-DE')} Nahtpaare
          </span>
          <span className="flex items-center gap-1.5">
            Nähte
            <span className="inline-block h-1.5 w-16 overflow-hidden rounded bg-zinc-800">
              <span className="block h-full bg-violet-500" style={{ width: `${progress}%` }} />
            </span>
            {progress}%
          </span>
          <span>Selbstkoll.: {st.selfPairs}</span>
          <span>t = {st.simTime.toFixed(1)} s</span>
        </>
      )}
      <span className="flex-1" />
      <span>Kollision: {backend === 'rapier' ? 'Rapier' : 'SDF'}</span>
      {st && <span>Solver {st.stepMs.toFixed(1)} ms</span>}
      <span>{fps.toFixed(0)} FPS</span>
    </footer>
  );
}
