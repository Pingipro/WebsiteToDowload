import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { simulation } from '../../physics/SimulationController';
import { useSimulationVersion } from '../../physics/useSimulationSync';
import { useStudioStore } from '../../store/useStudioStore';

/** Visualisiert die Naht-Zugbedingungen als farbige Linien zwischen den Partnerpartikeln. */
export function SeamLines3D() {
  useSimulationVersion();
  const solver = simulation.solver;
  const seams = useStudioStore((s) => s.seams);
  const selectedSeam = useStudioStore((s) => s.selection.seamId);
  const visible = useStudioStore((s) => s.view.showSeams3D);

  const { geometry, idx } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    if (!solver) return { geometry: g, idx: new Uint32Array(0) };
    const n = solver.seams.count;
    const pos = new Float32Array(n * 6);
    const col = new Float32Array(n * 6);
    const c = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const seam = seams[solver.seamIndex[k]];
      c.set(seam?.color ?? '#ffffff');
      if (selectedSeam && seam?.id !== selectedSeam) c.multiplyScalar(0.35);
      col.set([c.r, c.g, c.b, c.r, c.g, c.b], k * 6);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return { geometry: g, idx: solver.seams.ids };
  }, [solver, seams, selectedSeam]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    if (!solver || !visible) return;
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!attr) return;
    const out = attr.array as Float32Array;
    const p = solver.state.pos;
    for (let k = 0; k < idx.length / 2; k++) {
      const a = idx[2 * k] * 3;
      const b = idx[2 * k + 1] * 3;
      out[6 * k] = p[a];
      out[6 * k + 1] = p[a + 1];
      out[6 * k + 2] = p[a + 2];
      out[6 * k + 3] = p[b];
      out[6 * k + 4] = p[b + 1];
      out[6 * k + 5] = p[b + 2];
    }
    attr.needsUpdate = true;
    geometry.computeBoundingSphere();
  });

  return (
    <lineSegments geometry={geometry} visible={visible} renderOrder={2}>
      <lineBasicMaterial vertexColors transparent opacity={0.9} depthTest={false} />
    </lineSegments>
  );
}
