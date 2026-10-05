import { Grid2x2, Hand, Maximize2, MousePointer2, PenTool, Plus, Spline, Scissors } from 'lucide-react';
import type { ComponentType } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import type { EditorTool } from '../../types';

const TOOLS: { id: EditorTool; label: string; key: string; icon: ComponentType<{ size?: number }> }[] = [
  { id: 'select', label: 'Auswählen / Verschieben', key: 'V', icon: MousePointer2 },
  { id: 'addPoint', label: 'Punkt einfügen', key: 'P', icon: Plus },
  { id: 'curve', label: 'Kurve umschalten', key: 'C', icon: Spline },
  { id: 'seam', label: 'Naht definieren', key: 'S', icon: Scissors },
  { id: 'draw', label: 'Neues Schnittteil zeichnen', key: 'D', icon: PenTool },
  { id: 'pan', label: 'Ansicht verschieben', key: 'H', icon: Hand },
];

export function EditorToolbar({ onFit }: { onFit: () => void }) {
  const tool = useStudioStore((s) => s.tool);
  const setTool = useStudioStore((s) => s.setTool);
  const showMesh = useStudioStore((s) => s.view.showMesh2D);
  const setView = useStudioStore((s) => s.setView);

  return (
    <div className="absolute left-3 top-3 flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 shadow-xl backdrop-blur">
      {TOOLS.map(({ id, label, key, icon: Icon }) => (
        <button
          key={id}
          title={`${label} (${key})`}
          onClick={() => setTool(id)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            tool === id ? 'bg-violet-600 text-white shadow' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
      <div className="mx-1 h-5 w-px bg-zinc-700" />
      <button
        title="Triangulierung anzeigen"
        onClick={() => setView({ showMesh2D: !showMesh })}
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${showMesh ? 'bg-zinc-700 text-violet-300' : 'text-zinc-400 hover:bg-zinc-800'}`}
      >
        <Grid2x2 size={16} />
      </button>
      <button title="Ansicht einpassen (F)" onClick={onFit} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800">
        <Maximize2 size={16} />
      </button>
    </div>
  );
}
