import { Plus } from 'lucide-react';
import { FABRIC_PRESETS } from '../../materials/fabricPresets';
import { useStudioStore } from '../../store/useStudioStore';
import type { TexturePattern } from '../../types';
import { Section, Select, Slider } from './controls';

const TEXTURES: { value: TexturePattern; label: string }[] = [
  { value: 'none', label: 'Uni' },
  { value: 'knit', label: 'Strick / Jersey' },
  { value: 'denim', label: 'Denim (Köper)' },
  { value: 'stripes', label: 'Streifen' },
  { value: 'checks', label: 'Karo' },
  { value: 'dots', label: 'Punkte' },
];

/** Materialeigenschaften – Änderungen wirken live auf die laufende Simulation. */
export function FabricPanel() {
  const fabrics = useStudioStore((s) => s.fabrics);
  const pieces = useStudioStore((s) => s.pieces);
  const piece = useStudioStore((s) => s.pieces.find((p) => p.id === s.selection.pieceId));
  const setPieceFabric = useStudioStore((s) => s.setPieceFabric);
  const updateFabric = useStudioStore((s) => s.updateFabric);
  const addFabric = useStudioStore((s) => s.addFabric);
  const fabric = fabrics.find((f) => f.id === (piece?.fabricId ?? pieces[0]?.fabricId)) ?? fabrics[0];
  const usage = pieces.filter((p) => p.fabricId === fabric.id).length;

  const set = (patch: Parameters<typeof updateFabric>[1]) => updateFabric(fabric.id, patch);

  return (
    <>
      <Section title="Stoffbibliothek" actions={<button title="Neuer Stoff" onClick={() => addFabric(fabric)} className="text-zinc-400 hover:text-white"><Plus size={14} /></button>}>
        <div className="grid grid-cols-3 gap-1.5">
          {fabrics.map((f) => (
            <button
              key={f.id}
              onClick={() => (piece ? setPieceFabric(piece.id, f.id) : undefined)}
              title={piece ? `„${f.name}“ dem Teil „${piece.name}“ zuweisen` : f.name}
              className={`group flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] transition-colors ${
                f.id === fabric.id ? 'border-violet-500 bg-violet-500/10 text-zinc-100' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              <span className="h-6 w-full rounded" style={{ background: f.color, boxShadow: 'inset 0 -6px 10px rgba(0,0,0,.25)' }} />
              <span className="w-full truncate text-center">{f.name}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500">
          {piece ? (
            <>Teil „{piece.name}“ · Stoff wird von {usage} Teil(en) verwendet</>
          ) : (
            'Kein Teil gewählt – Klick auf ein Schnittteil (2D oder 3D), um ihm einen Stoff zuzuweisen.'
          )}
        </p>
      </Section>

      <Section title={`Eigenschaften · ${fabric.name}`}>
        <input
          value={fabric.name}
          onChange={(e) => set({ name: e.target.value })}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-violet-500"
        />
        <Select
          label="Vorlage"
          value={'' as string}
          options={[{ value: '', label: 'Parameter übernehmen …' }, ...FABRIC_PRESETS.map((p) => ({ value: p.name, label: p.name }))]}
          onChange={(name) => {
            const p = FABRIC_PRESETS.find((x) => x.name === name);
            if (p) set({ ...p, name: fabric.name });
          }}
        />
        <Slider label="Gewicht (Dichte)" value={fabric.density} min={30} max={600} step={5} unit="g/m²" digits={0} onChange={(v) => set({ density: v })} hint="Flächengewicht – beeinflusst Masse und Fallverhalten" />
        <Slider label="Dehnsteifigkeit" value={fabric.stretchStiffness} min={0} max={1} onChange={(v) => set({ stretchStiffness: v })} hint="1 = praktisch undehnbar (Webware), niedrig = elastisch (Strick/Elasthan)" />
        <Slider label="Biegesteifigkeit" value={fabric.bendStiffness} min={0} max={1} onChange={(v) => set({ bendStiffness: v })} hint="Niedrig = fließend (Seide), hoch = steif (Denim, Leder)" />
        <Slider label="Dämpfung" value={fabric.damping} min={0} max={3} onChange={(v) => set({ damping: v })} hint="Innere Dämpfung / Luftwiderstand (1/s)" />
        <Slider label="Reibung" value={fabric.friction} min={0} max={1} onChange={(v) => set({ friction: v })} hint="Haft-/Gleitreibung Stoff ↔ Avatar (Gleitfähigkeit)" />
        <Slider label="Dicke" value={fabric.thickness} min={0.3} max={6} step={0.1} unit="mm" digits={1} onChange={(v) => set({ thickness: v })} hint="Kollisionsabstand" />
      </Section>

      <Section title="Darstellung">
        <label className="flex items-center justify-between text-xs">
          <span className="text-zinc-300">Farbe</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-zinc-500">{fabric.color}</span>
            <input type="color" value={fabric.color} onChange={(e) => set({ color: e.target.value })} className="h-7 w-10 cursor-pointer rounded border border-zinc-700 bg-transparent" />
          </span>
        </label>
        <Select label="Textur" value={fabric.texture} options={TEXTURES} onChange={(v) => set({ texture: v })} />
        <Slider label="Texturgröße" value={fabric.textureScale} min={0.5} max={20} step={0.5} unit="cm" digits={1} onChange={(v) => set({ textureScale: v })} />
        <Slider label="Rauheit" value={fabric.roughness} min={0} max={1} onChange={(v) => set({ roughness: v })} />
        <Slider label="Glanz (Sheen)" value={fabric.sheen} min={0} max={1} onChange={(v) => set({ sheen: v })} />
      </Section>
    </>
  );
}
