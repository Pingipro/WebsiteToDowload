import { useEffect, useSyncExternalStore } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import { simulation } from './SimulationController';

/**
 * Verbindet den Zustand-Store mit der Simulation:
 *  - Geometrie/Nähte/Platzierung → Neuaufbau (entprellt)
 *  - Stoffe → Live-Update der Materialparameter ohne Neuaufbau
 *  - Simulationseinstellungen → Live-Update
 *  - Avatar → neue Kollider
 */
export function useSimulationSync(): void {
  useEffect(() => {
    const st = useStudioStore.getState();
    simulation.updateAvatar(st.avatar, st.sim.colliderBackend);
    simulation.rebuild(st);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useStudioStore.subscribe((s, prev) => {
      if (s.geometryVersion !== prev.geometryVersion) {
        clearTimeout(timer);
        timer = setTimeout(() => simulation.rebuild(useStudioStore.getState()), 250);
      }
      if (s.fabrics !== prev.fabrics || s.pieces !== prev.pieces) simulation.applyFabrics(s);
      if (s.sim !== prev.sim) {
        simulation.solver?.applySettings(s.sim);
        if (s.sim.colliderBackend !== prev.sim.colliderBackend) void simulation.setBackend(s.sim.colliderBackend, s.avatar);
      }
      if (s.avatar !== prev.avatar) simulation.updateAvatar(s.avatar, s.sim.colliderBackend);
      if (s.resetToken !== prev.resetToken) simulation.solver?.reset();
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);
}

/** Re-rendert, sobald der Solver neu aufgebaut wurde. */
export function useSimulationVersion(): number {
  return useSyncExternalStore(simulation.subscribe, simulation.getVersion);
}
