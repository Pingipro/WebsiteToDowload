import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getFabricTexture } from '../../materials/fabricTextures';
import type { PieceRange } from '../../physics/buildCloth';
import type { ClothSolver } from '../../physics/ClothSolver';
import { simulation } from '../../physics/SimulationController';
import { useSimulationVersion } from '../../physics/useSimulationSync';
import { useStudioStore } from '../../store/useStudioStore';

const FRAME_DT = 1 / 60;

/**
 * Rendert alle Stoffteile des aktuellen Solvers und treibt die Simulation an.
 * Die Positions-Attribute teilen sich den Speicher mit dem Solver (subarray) –
 * pro Frame genügt `needsUpdate` + Normalen-Neuberechnung.
 */
export function ClothPieces({ grabMode }: { grabMode: boolean }) {
  useSimulationVersion();
  const solver = simulation.solver;
  const running = useStudioStore((s) => s.sim.running);
  const geometries = useRef<THREE.BufferGeometry[]>([]);

  useFrame(() => {
    if (!solver) return;
    if (running) simulation.step(FRAME_DT);
    for (const g of geometries.current) {
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      pos.needsUpdate = true;
      g.computeVertexNormals();
      g.computeBoundingSphere();
    }
  });

  if (!solver) return null;
  return (
    <group>
      {solver.pieces.map((r) => (
        <ClothPiece key={`${simulation.version}-${r.pieceId}`} solver={solver} range={r} registry={geometries} grabMode={grabMode} />
      ))}
    </group>
  );
}

interface ClothPieceProps {
  solver: ClothSolver;
  range: PieceRange;
  registry: React.RefObject<THREE.BufferGeometry[]>;
  grabMode: boolean;
}

function ClothPiece({ solver, range, registry, grabMode }: ClothPieceProps) {
  const piece = useStudioStore((s) => s.pieces.find((p) => p.id === range.pieceId));
  const fabric = useStudioStore((s) => s.fabrics.find((f) => f.id === piece?.fabricId));
  const selected = useStudioStore((s) => s.selection.pieceId === range.pieceId);
  const hovered = useStudioStore((s) => s.hoverPieceId === range.pieceId);
  const wireframe = useStudioStore((s) => s.view.showWireframe);
  const select = useStudioStore((s) => s.select);
  const setHover = useStudioStore((s) => s.setHoverPiece);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = solver.state.pos.subarray(range.start * 3, (range.start + range.count) * 3);
    const attr = new THREE.BufferAttribute(pos, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', attr);
    const uv = new Float32Array(range.count * 2);
    const P = range.mesh.positions2D;
    for (let i = 0; i < range.count; i++) {
      uv[2 * i] = P[2 * i];
      uv[2 * i + 1] = -P[2 * i + 1];
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(range.localIndices, 1));
    g.computeVertexNormals();
    return g;
  }, [solver, range]);

  useEffect(() => {
    const list = registry.current;
    list.push(geometry);
    return () => {
      const i = list.indexOf(geometry);
      if (i >= 0) list.splice(i, 1);
      geometry.dispose();
    };
  }, [geometry, registry]);

  const map = useMemo(() => {
    if (!fabric) return null;
    const tex = getFabricTexture(fabric.texture, fabric.color);
    if (!tex) return null;
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(1 / fabric.textureScale, 1 / fabric.textureScale);
    return t;
  }, [fabric]);

  useEffect(() => () => map?.dispose(), [map]);

  // --- Interaktion: Auswahl & Ziehen ----------------------------------------------
  const dragging = useRef(false);
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!grabMode || e.button !== 0) return;
    e.stopPropagation();
    const idx = solver.nearestParticle(e.point.x, e.point.y, e.point.z, range.index);
    if (idx < 0) return;
    dragging.current = true;
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    solver.grab(idx, e.point.x, e.point.y, e.point.z);
    // Ebene parallel zur Bildebene durch den Greifpunkt
    const normal = new THREE.Vector3();
    e.camera.getWorldDirection(normal);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, e.point.clone());
    const onMove = (ev: PointerEvent) => {
      const rect = (e.nativeEvent.target as HTMLElement).getBoundingClientRect();
      const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, e.camera);
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(plane, hit)) solver.moveGrab(hit.x, hit.y, hit.z);
    };
    const onUp = () => {
      dragging.current = false;
      solver.release();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return; // Orbit-Drag ist kein Klick
    e.stopPropagation();
    select({ pieceId: range.pieceId, pointId: null, seamId: null });
  };

  const color = fabric?.color ?? '#cccccc';
  const emissive = selected ? '#5b21b6' : hovered ? '#3f3f46' : '#000000';

  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onPointerDown={onPointerDown}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(range.pieceId);
      }}
      onPointerOut={() => setHover(null)}
    >
      <meshPhysicalMaterial
        color={map ? '#ffffff' : color}
        map={map}
        side={THREE.DoubleSide}
        roughness={fabric?.roughness ?? 0.8}
        sheen={fabric?.sheen ?? 0.5}
        sheenRoughness={0.6}
        sheenColor={color}
        emissive={emissive}
        emissiveIntensity={selected ? 0.35 : hovered ? 0.25 : 0}
        wireframe={wireframe}
      />
    </mesh>
  );
}
