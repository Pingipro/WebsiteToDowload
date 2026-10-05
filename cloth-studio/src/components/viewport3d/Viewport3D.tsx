import { ContactShadows, Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Hand, Orbit, Pause, Play, RotateCcw, Wind } from 'lucide-react';
import { Suspense, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStudioStore } from '../../store/useStudioStore';
import { Avatar } from './Avatar';
import { ClothPieces } from './ClothPieces';
import { SeamLines3D } from './SeamLines3D';
import { WindIndicator } from './WindIndicator';

const CAMERA_PRESETS: { label: string; pos: [number, number, number] }[] = [
  { label: 'Vorne', pos: [0, 1.25, 2.6] },
  { label: 'Seite', pos: [2.6, 1.25, 0] },
  { label: 'Hinten', pos: [0, 1.25, -2.6] },
  { label: '¾', pos: [1.8, 1.6, 1.9] },
];

/** 3D-Viewport: Szene, Beleuchtung, Avatar, Stoff und Steuerelemente. */
export function Viewport3D() {
  const [grabMode, setGrabMode] = useState(false);
  const [controls, setControls] = useState<OrbitControlsImpl | null>(null);
  const running = useStudioStore((s) => s.sim.running);
  const wind = useStudioStore((s) => s.sim.windEnabled);
  const setSim = useStudioStore((s) => s.setSim);
  const reset = useStudioStore((s) => s.resetSimulation);
  const select = useStudioStore((s) => s.select);

  const setCamera = (pos: [number, number, number]) => {
    if (!controls) return;
    controls.object.position.set(...pos);
    controls.target.set(0, 1.0, 0);
    controls.update();
  };

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 1.25, 2.6], fov: 38, near: 0.05, far: 50 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: true }}
        onPointerMissed={() => select({ pieceId: null, pointId: null, seamId: null })}
      >
        <color attach="background" args={['#1b1b20']} />
        <fog attach="fog" args={['#1b1b20', 5, 12]} />
        <hemisphereLight args={['#f4f4f5', '#27272a', 0.6]} />
        <directionalLight
          position={[2.5, 4, 2.5]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-1.5}
          shadow-camera-right={1.5}
          shadow-camera-top={2.2}
          shadow-camera-bottom={-0.5}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />
        <directionalLight position={[-3, 2, -2]} intensity={0.7} color="#c4b5fd" />
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={2} position={[0, 4, 2]} scale={[6, 2, 1]} />
          <Lightformer form="rect" intensity={1} position={[-4, 2, 0]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} color="#ddd6fe" />
          <Lightformer form="rect" intensity={1.2} position={[4, 2, 0]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} />
          <Lightformer form="ring" intensity={0.8} position={[0, 2, -4]} scale={2} />
        </Environment>

        <Suspense fallback={null}>
          <Avatar />
          <ClothPieces grabMode={grabMode} />
          <SeamLines3D />
          {wind && <WindIndicator />}
        </Suspense>

        <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.001, 0]}>
          <circleGeometry args={[3, 64]} />
          <meshStandardMaterial color="#232329" roughness={1} />
        </mesh>
        <ContactShadows position={[0, 0.001, 0]} opacity={0.55} scale={3} blur={2.4} far={1.2} />
        <Grid
          position={[0, 0.002, 0]}
          args={[6, 6]}
          cellSize={0.1}
          cellThickness={0.5}
          cellColor="#2f2f37"
          sectionSize={0.5}
          sectionThickness={1}
          sectionColor="#3f3f4a"
          fadeDistance={6}
          fadeStrength={1.5}
          infiniteGrid={false}
        />
        <OrbitControls ref={setControls} makeDefault target={[0, 1.0, 0]} enabled={!grabMode} minDistance={0.4} maxDistance={8} maxPolarAngle={Math.PI * 0.95} />
      </Canvas>

      {/* Overlay-Steuerung */}
      <div className="absolute left-3 top-3 flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 shadow-xl backdrop-blur">
        <button
          title={running ? 'Simulation pausieren (Leertaste)' : 'Simulation starten (Leertaste)'}
          onClick={() => setSim({ running: !running })}
          className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${running ? 'bg-emerald-600/90 text-white' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}`}
        >
          {running ? <Pause size={14} /> : <Play size={14} />}
          {running ? 'Simuliert' : 'Pausiert'}
        </button>
        <button title="Auf Ausgangslage zurücksetzen (R)" onClick={reset} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-800">
          <RotateCcw size={15} />
        </button>
        <div className="mx-1 h-5 w-px bg-zinc-700" />
        <button
          title="Kamera drehen/zoomen"
          onClick={() => setGrabMode(false)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${!grabMode ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
        >
          <Orbit size={15} />
        </button>
        <button
          title="Stoff greifen und ziehen"
          onClick={() => setGrabMode(true)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${grabMode ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
        >
          <Hand size={15} />
        </button>
        <button
          title="Wind ein/aus"
          onClick={() => setSim({ windEnabled: !wind })}
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${wind ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
        >
          <Wind size={15} />
        </button>
      </div>

      <div className="absolute right-3 top-3 flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 text-[11px] shadow-xl backdrop-blur">
        {CAMERA_PRESETS.map((c) => (
          <button key={c.label} onClick={() => setCamera(c.pos)} className="rounded-lg px-2 py-1.5 text-zinc-300 hover:bg-zinc-800">
            {c.label}
          </button>
        ))}
      </div>

      <SimulationHud />
    </div>
  );
}

function SimulationHud() {
  return (
    <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-zinc-500">
      Linke Maus: drehen · Rechte Maus: verschieben · Mausrad: zoomen · Klick auf Stoff: Teil auswählen
    </div>
  );
}
