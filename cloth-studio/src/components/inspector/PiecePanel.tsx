import { Copy, Eye, EyeOff, Trash2 } from 'lucide-react';
import { bounds, flattenOutline, signedArea } from '../../geometry/outline';
import { useStudioStore } from '../../store/useStudioStore';
import type { Vec3 } from '../../types';
import { IconButton, Section, Slider } from './controls';

/** Schnittteil-Liste und Anordnung (Platzierung im 3D-Raum). */
export function PiecePanel() {
  const pieces = useStudioStore((s) => s.pieces);
  const fabrics = useStudioStore((s) => s.fabrics);
  const selectedId = useStudioStore((s) => s.selection.pieceId);
  const select = useStudioStore((s) => s.select);
  const hoverId = useStudioStore((s) => s.hoverPieceId);
  const setHover = useStudioStore((s) => s.setHoverPiece);
  const { renamePiece, togglePieceVisible, duplicatePiece, deletePiece, setPiecePlacement } = useStudioStore.getState();
  const piece = pieces.find((p) => p.id === selectedId);

  const outline = piece ? flattenOutline(piece.points, 16) : [];
  const b = piece ? bounds(outline) : null;
  const area = piece ? Math.abs(signedArea(outline)) : 0;
  const pl = piece?.placement;
  const setOrigin = (k: number, v: number) => {
    if (!piece || !pl) return;
    const o = [...pl.origin] as Vec3;
    o[k] = v;
    setPiecePlacement(piece.id, { origin: o });
  };

  return (
    <>
      <Section title={`Schnittteile (${pieces.length})`}>
        <ul className="space-y-0.5">
          {pieces.map((p) => {
            const f = fabrics.find((x) => x.id === p.fabricId);
            return (
              <li
                key={p.id}
                onClick={() => select({ pieceId: p.id, pointId: null, seamId: null })}
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
                className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs ${
                  p.id === selectedId ? 'bg-violet-500/15 text-zinc-100' : hoverId === p.id ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400 hover:bg-zinc-800/60'
                }`}
              >
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: f?.color }} />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-[10px] text-zinc-500">{f?.name}</span>
                <span onClick={(e) => e.stopPropagation()}>
                  <IconButton title={p.visible ? 'In Simulation ausblenden' : 'Einblenden'} onClick={() => togglePieceVisible(p.id)}>
                    {p.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </IconButton>
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      {piece && pl && b && (
        <>
          <Section
            title="Ausgewähltes Teil"
            actions={
              <div className="flex">
                <IconButton title="Duplizieren" onClick={() => duplicatePiece(piece.id)}>
                  <Copy size={13} />
                </IconButton>
                <IconButton title="Löschen" danger onClick={() => deletePiece(piece.id)}>
                  <Trash2 size={13} />
                </IconButton>
              </div>
            }
          >
            <input
              value={piece.name}
              onChange={(e) => renamePiece(piece.id, e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-violet-500"
            />
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <Stat label="Breite" value={`${b.w.toFixed(1)} cm`} />
              <Stat label="Höhe" value={`${b.h.toFixed(1)} cm`} />
              <Stat label="Fläche" value={`${(area / 1e4).toFixed(3)} m²`} />
            </div>
          </Section>

          <Section title="Anordnung (3D-Platzierung)">
            <p className="-mt-1 text-[11px] leading-snug text-zinc-500">
              Das Teil wird um einen Zylinder gewickelt (wie Arrangement-Punkte in CLO). Änderungen setzen die Simulation dieses Projekts neu auf.
            </p>
            <Slider label="Position X" value={pl.origin[0]} min={-1} max={1} unit="m" onChange={(v) => setOrigin(0, v)} />
            <Slider label="Position Y (Höhe)" value={pl.origin[1]} min={0} max={2} unit="m" onChange={(v) => setOrigin(1, v)} />
            <Slider label="Position Z" value={pl.origin[2]} min={-1} max={1} unit="m" onChange={(v) => setOrigin(2, v)} />
            <Slider label="Winkel um Achse" value={pl.angle} min={-180} max={360} step={1} unit="°" digits={0} onChange={(v) => setPiecePlacement(piece.id, { angle: v })} />
            <Slider label="Wickelradius (0 = flach)" value={pl.radius} min={0} max={0.6} step={0.005} unit="m" digits={3} onChange={(v) => setPiecePlacement(piece.id, { radius: v })} />
            <Slider label="Achsneigung Z" value={pl.tilt[2]} min={-90} max={90} step={1} unit="°" digits={0} onChange={(v) => setPiecePlacement(piece.id, { tilt: [pl.tilt[0], pl.tilt[1], v] })} />
            <Slider label="Achsneigung X" value={pl.tilt[0]} min={-90} max={90} step={1} unit="°" digits={0} onChange={(v) => setPiecePlacement(piece.id, { tilt: [v, pl.tilt[1], pl.tilt[2]] })} />
          </Section>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-zinc-800/70 px-1 py-1.5">
      <div className="text-zinc-500">{label}</div>
      <div className="font-mono text-zinc-200">{value}</div>
    </div>
  );
}
