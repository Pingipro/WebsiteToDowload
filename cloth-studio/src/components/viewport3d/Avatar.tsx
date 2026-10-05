import { useMemo } from 'react';
import * as THREE from 'three';
import { AvatarSdf } from '../../avatar/avatarSdf';
import { meshSdf } from '../../avatar/surfaceNets';
import { simulation } from '../../physics/SimulationController';
import { useSimulationVersion } from '../../physics/useSimulationSync';
import { useStudioStore } from '../../store/useStudioStore';

/** Glattes Mannequin (Surface-Nets-Polygonisierung des Avatar-SDF) + optionale Kollider-Ansicht. */
export function Avatar() {
  useSimulationVersion();
  const model = simulation.avatar;
  const skin = useStudioStore((s) => s.avatar.skinColor);
  const visible = useStudioStore((s) => s.view.showAvatar);
  const showColliders = useStudioStore((s) => s.view.showColliders);

  const geometry = useMemo(() => meshSdf(new AvatarSdf(model), 0.011), [model]);

  const colliders = useMemo(() => {
    if (!showColliders) return null;
    return model.primitives.map((p, i) => {
      const a = new THREE.Vector3(...p.a);
      const b = new THREE.Vector3(...p.b);
      const len = a.distanceTo(b);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      return { key: i, len, mid, q, r: (p.ra + p.rb) / 2 };
    });
  }, [model, showColliders]);

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow visible={visible}>
        <meshPhysicalMaterial color={skin} roughness={0.55} metalness={0} clearcoat={0.25} clearcoatRoughness={0.6} sheen={0.2} />
      </mesh>
      {colliders?.map((c) => (
        <mesh key={c.key} position={c.mid} quaternion={c.q}>
          <capsuleGeometry args={[c.r, c.len, 4, 12]} />
          <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  );
}
