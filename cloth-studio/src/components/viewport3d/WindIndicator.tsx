import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useStudioStore } from '../../store/useStudioStore';

/** Kleiner animierter Pfeil, der Windrichtung und -stärke anzeigt. */
export function WindIndicator() {
  const dir = useStudioStore((s) => s.sim.windDirection);
  const strength = useStudioStore((s) => s.sim.windStrength);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = 1.72 + Math.sin(clock.elapsedTime * 2) * 0.02;
  });
  const a = (dir * Math.PI) / 180;
  const len = 0.15 + strength * 0.03;
  return (
    <group ref={ref} position={[-Math.sin(a) * 0.8, 1.72, -Math.cos(a) * 0.8]} rotation={[0, a, 0]}>
      <mesh rotation-x={Math.PI / 2} position={[0, 0, len / 2]}>
        <cylinderGeometry args={[0.012, 0.012, len, 8]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, 0, len + 0.04]}>
        <coneGeometry args={[0.035, 0.08, 12]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
    </group>
  );
}
