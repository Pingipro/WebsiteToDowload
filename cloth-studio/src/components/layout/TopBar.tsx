import { Download, FilePlus2, Shirt, Upload } from 'lucide-react';
import { useRef } from 'react';
import { GARMENT_PRESETS } from '../../patterns/presets';
import { exportProject, useStudioStore, type ProjectFile } from '../../store/useStudioStore';

/** Kopfleiste: Projektvorlagen, Import/Export. */
export function TopBar() {
  const loadPreset = useStudioStore((s) => s.loadPreset);
  const importProject = useStudioStore((s) => s.importProject);
  const fileInput = useRef<HTMLInputElement>(null);

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportProject(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schnittmuster.cloth.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as ProjectFile;
      if (!Array.isArray(data.pieces) || !Array.isArray(data.seams)) throw new Error('Ungültiges Format');
      importProject(data);
    } catch (err) {
      alert(`Import fehlgeschlagen: ${(err as Error).message}`);
    }
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-900/40">
          <Shirt size={16} className="text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-zinc-100">Cloth Studio</div>
          <div className="text-[10px] text-zinc-500">2D-Schnitt · 3D-Simulation</div>
        </div>
      </div>

      <div className="mx-2 h-6 w-px bg-zinc-800" />

      <div className="flex items-center gap-1">
        <FilePlus2 size={14} className="mr-1 text-zinc-500" />
        {GARMENT_PRESETS.map((p) => (
          <button key={p.id} onClick={() => loadPreset(p.id)} className="rounded-md px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white">
            {p.name}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
      <button onClick={() => fileInput.current?.click()} className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800">
        <Upload size={14} /> Öffnen
      </button>
      <button onClick={doExport} className="flex items-center gap-1.5 rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-500">
        <Download size={14} /> Speichern
      </button>
    </header>
  );
}
