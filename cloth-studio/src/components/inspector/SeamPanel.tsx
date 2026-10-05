import { ArrowLeftRight, Scissors, Trash2, TriangleAlert } from 'lucide-react';
import { seamSideLength } from '../../geometry/outline';
import { useStudioStore } from '../../store/useStudioStore';
import { IconButton, Section } from './controls';

/** Nähte-Verwaltung: Liste, Längenvergleich, Richtung umkehren, löschen. */
export function SeamPanel() {
  const seams = useStudioStore((s) => s.seams);
  const pieces = useStudioStore((s) => s.pieces);
  const selectedSeam = useStudioStore((s) => s.selection.seamId);
  const tool = useStudioStore((s) => s.tool);
  const pending = useStudioStore((s) => s.pendingSeam);
  const { select, flipSeam, deleteSeam, setTool } = useStudioStore.getState();

  return (
    <Section
      title={`Nähte (${seams.length})`}
      actions={
        <button
          onClick={() => setTool('seam')}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${tool === 'seam' ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
        >
          <Scissors size={12} /> Naht-Werkzeug
        </button>
      }
    >
      {tool === 'seam' && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
          {pending ? 'Erste Seite gewählt – jetzt die Gegenkante anklicken (Shift+Klick erweitert die erste Seite).' : 'Im 2D-Editor die erste Kante der neuen Naht anklicken.'}
        </p>
      )}
      {seams.length === 0 && <p className="text-xs text-zinc-500">Noch keine Nähte definiert.</p>}
      <ul className="space-y-1">
        {seams.map((seam, i) => {
          const pa = pieces.find((p) => p.id === seam.a.pieceId);
          const pb = pieces.find((p) => p.id === seam.b.pieceId);
          if (!pa || !pb) return null;
          const la = seamSideLength(pa, seam.a);
          const lb = seamSideLength(pb, seam.b);
          const diff = Math.abs(la - lb);
          const warn = diff > Math.max(1, 0.08 * Math.max(la, lb));
          const sel = seam.id === selectedSeam;
          return (
            <li
              key={seam.id}
              onClick={() => select({ seamId: sel ? null : seam.id })}
              className={`cursor-pointer rounded-lg border px-2 py-1.5 text-xs transition-colors ${sel ? 'border-violet-500/70 bg-violet-500/10' : 'border-zinc-800 hover:border-zinc-700'}`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold" style={{ borderColor: seam.color, color: seam.color }}>
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-zinc-200">
                  {pa.name} <span className="text-zinc-500">↔</span> {pb.name}
                </span>
                <span onClick={(e) => e.stopPropagation()} className="flex">
                  <IconButton title="Richtung umkehren (verdrehte Naht korrigieren)" onClick={() => flipSeam(seam.id)}>
                    <ArrowLeftRight size={13} />
                  </IconButton>
                  <IconButton title="Naht löschen" danger onClick={() => deleteSeam(seam.id)}>
                    <Trash2 size={13} />
                  </IconButton>
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 pl-7 font-mono text-[10px] text-zinc-500">
                <span>{la.toFixed(1)} cm</span>
                <span>/</span>
                <span>{lb.toFixed(1)} cm</span>
                {seam.reversed && <span className="rounded bg-zinc-800 px-1 text-zinc-400">umgekehrt</span>}
                {warn && (
                  <span className="flex items-center gap-0.5 text-amber-400" title="Kantenlängen weichen deutlich ab (Einhalten/Mehrweite)">
                    <TriangleAlert size={11} /> Δ {diff.toFixed(1)} cm
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
