import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bounds, flattenOutline, outlineToSvgPath, seamSidePolyline } from '../../geometry/outline';
import { triangulatePiece } from '../../geometry/triangulate';
import { useStudioStore } from '../../store/useStudioStore';
import type { PatternPiece, Vec2 } from '../../types';
import { EditorToolbar } from './EditorToolbar';
import { closestOnSegment, screenToWorld, segmentInfo, segmentPath, snap, worldToPiece, type View } from './editorMath';

type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'piece'; pieceId: string; start: Vec2; offset: Vec2 }
  | { kind: 'point'; pieceId: string; pointId: string }
  | { kind: 'control'; pieceId: string; pointId: string; which: 'c1' | 'c2' };

/**
 * 2D-Schnittmuster-Editor (SVG). Koordinaten in cm; Zoom/Pan über eine View-Transformation.
 * Werkzeuge: Auswahl/Verschieben, Punkt einfügen, Kurve umschalten, Naht definieren,
 * neues Teil zeichnen, Hand (Pan).
 */
export function PatternEditor() {
  const pieces = useStudioStore((s) => s.pieces);
  const seams = useStudioStore((s) => s.seams);
  const fabrics = useStudioStore((s) => s.fabrics);
  const selection = useStudioStore((s) => s.selection);
  const hoverPieceId = useStudioStore((s) => s.hoverPieceId);
  const tool = useStudioStore((s) => s.tool);
  const pendingSeam = useStudioStore((s) => s.pendingSeam);
  const showMesh = useStudioStore((s) => s.view.showMesh2D);
  const resolution = useStudioStore((s) => s.sim.resolution);
  const triangulation = useStudioStore((s) => s.sim.triangulation);
  const actions = useStudioStore.getState;

  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ x: 40, y: 60, k: 4 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const drag = useRef<Drag | null>(null);
  const [hoverSeg, setHoverSeg] = useState<{ pieceId: string; index: number } | null>(null);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [draft, setDraft] = useState<Vec2[]>([]);
  const fittedFor = useRef<string>('');

  // Größe beobachten
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitView = useCallback(() => {
    if (pieces.length === 0) return;
    const pts = pieces.flatMap((p) => flattenOutline(p.points, 4).map((q) => ({ x: q.x + p.offset.x, y: q.y + p.offset.y })));
    const b = bounds(pts);
    const k = Math.min((size.w - 80) / Math.max(b.w, 1), (size.h - 120) / Math.max(b.h, 1));
    setView({ k, x: size.w / 2 - b.cx * k, y: size.h / 2 - b.cy * k + 20 });
  }, [pieces, size]);

  // Beim Laden eines neuen Projekts einpassen
  const pieceKey = pieces.map((p) => p.id).join('|');
  useEffect(() => {
    if (size.w < 50) return;
    if (fittedFor.current === pieceKey) return;
    const prevIds = new Set(fittedFor.current.split('|'));
    const isNewProject = !pieces.some((p) => prevIds.has(p.id));
    fittedFor.current = pieceKey;
    if (isNewProject) fitView();
  }, [pieceKey, size, fitView, pieces]);

  const toWorld = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = svgRef.current!.getBoundingClientRect();
      return screenToWorld(view, e.clientX - rect.left, e.clientY - rect.top);
    },
    [view],
  );

  // --- Tastatur ------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
      const st = actions();
      const map: Record<string, typeof st.tool> = { v: 'select', p: 'addPoint', c: 'curve', s: 'seam', d: 'draw', h: 'pan' };
      if (!e.ctrlKey && !e.metaKey && map[e.key.toLowerCase()]) {
        st.setTool(map[e.key.toLowerCase()]);
        setDraft([]);
        return;
      }
      if (e.key === 'Escape') {
        st.cancelSeam();
        setDraft([]);
        st.select({ pointId: null });
      }
      if (e.key === 'Enter' && draft.length >= 3) finishDraft();
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = st.selection;
        if (sel.pointId && sel.pieceId) st.deletePoint(sel.pieceId, sel.pointId);
        else if (sel.seamId) st.deleteSeam(sel.seamId);
        else if (sel.pieceId) st.deletePiece(sel.pieceId);
      }
      if (e.key === 'f') fitView();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const finishDraft = () => {
    if (draft.length >= 3) actions().addPiece(`Teil ${actions().pieces.length + 1}`, draft, { x: 0, y: 0 });
    setDraft([]);
    actions().setTool('select');
  };

  // --- Zeiger ----------------------------------------------------------------------
  const onWheel = (e: React.WheelEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    setView((v) => {
      const k = Math.min(60, Math.max(0.5, v.k * factor));
      const wx = (sx - v.x) / v.k;
      const wy = (sy - v.y) / v.k;
      return { k, x: sx - wx * k, y: sy - wy * k };
    });
  };

  const beginPan = (e: React.PointerEvent) => {
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
  };

  const onBackgroundDown = (e: React.PointerEvent) => {
    svgRef.current?.setPointerCapture(e.pointerId);
    if (e.button === 1 || tool === 'pan' || e.button === 0 && tool === 'select') {
      if (tool === 'select' && e.button === 0) actions().select({ pieceId: null, pointId: null, seamId: null });
      beginPan(e);
      return;
    }
    if (tool === 'draw' && e.button === 0) {
      const w = toWorld(e);
      const p = { x: snap(w.x, 0.5), y: snap(w.y, 0.5) };
      if (draft.length >= 3) {
        const first = draft[0];
        if (Math.hypot(first.x - p.x, first.y - p.y) * view.k < 10) {
          finishDraft();
          return;
        }
      }
      setDraft((d) => [...d, p]);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const w = toWorld(e);
    setCursor(w);
    const d = drag.current;
    if (!d) return;
    const st = actions();
    switch (d.kind) {
      case 'pan':
        setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
        break;
      case 'piece':
        st.movePiece(d.pieceId, { x: snap(d.offset.x + w.x - d.start.x, 0.5), y: snap(d.offset.y + w.y - d.start.y, 0.5) });
        break;
      case 'point': {
        const piece = st.pieces.find((p) => p.id === d.pieceId);
        if (!piece) break;
        const l = worldToPiece(piece, w);
        st.movePoint(d.pieceId, d.pointId, { x: snap(l.x), y: snap(l.y) });
        break;
      }
      case 'control': {
        const piece = st.pieces.find((p) => p.id === d.pieceId);
        if (!piece) break;
        const l = worldToPiece(piece, w);
        st.moveControl(d.pieceId, d.pointId, d.which, { x: snap(l.x), y: snap(l.y) });
        break;
      }
    }
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const onPieceDown = (e: React.PointerEvent, piece: PatternPiece) => {
    if (e.button === 1 || tool === 'pan') {
      svgRef.current?.setPointerCapture(e.pointerId);
      beginPan(e);
      return;
    }
    if (tool === 'draw') return; // an Hintergrund weiterreichen
    e.stopPropagation();
    if (tool !== 'select') return;
    svgRef.current?.setPointerCapture(e.pointerId);
    actions().select({ pieceId: piece.id, pointId: null, seamId: null });
    drag.current = { kind: 'piece', pieceId: piece.id, start: toWorld(e), offset: { ...piece.offset } };
  };

  const onSegmentDown = (e: React.PointerEvent, piece: PatternPiece, index: number) => {
    if (tool === 'select') {
      onPieceDown(e, piece);
      return;
    }
    if (tool === 'pan' || tool === 'draw' || e.button !== 0) return;
    e.stopPropagation();
    const st = actions();
    if (tool === 'addPoint') {
      const local = worldToPiece(piece, toWorld(e));
      const { t, point } = closestOnSegment(piece, index, local);
      st.select({ pieceId: piece.id });
      st.insertPoint(piece.id, index, t, point);
      const newId = actions().selection.pointId;
      if (newId) {
        svgRef.current?.setPointerCapture(e.pointerId);
        drag.current = { kind: 'point', pieceId: piece.id, pointId: newId };
      }
    } else if (tool === 'curve') {
      st.select({ pieceId: piece.id });
      st.toggleCurve(piece.id, index);
    } else if (tool === 'seam') {
      st.pickSeamEdge(piece.id, index, e.shiftKey);
    }
  };

  const onVertexDown = (e: React.PointerEvent, piece: PatternPiece, pointId: string) => {
    if (tool !== 'select' && tool !== 'addPoint' && tool !== 'curve') return;
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    actions().select({ pieceId: piece.id, pointId, seamId: null });
    drag.current = { kind: 'point', pieceId: piece.id, pointId };
  };

  const onControlDown = (e: React.PointerEvent, piece: PatternPiece, pointId: string, which: 'c1' | 'c2') => {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    drag.current = { kind: 'control', pieceId: piece.id, pointId, which };
  };

  // --- Darstellung --------------------------------------------------------------
  const k = view.k;
  const fabricById = useMemo(() => new Map(fabrics.map((f) => [f.id, f])), [fabrics]);
  const meshes = useMemo(
    () => (showMesh ? new Map(pieces.map((p) => [p.id, triangulatePiece(p, resolution, triangulation)])) : null),
    [showMesh, pieces, resolution, triangulation],
  );

  const gridMinor = k > 6 ? 1 : 5;
  const cursorClass = {
    select: 'cursor-default',
    addPoint: 'cursor-copy',
    curve: 'cursor-pointer',
    seam: 'cursor-crosshair',
    draw: 'cursor-crosshair',
    pan: 'cursor-grab',
  }[tool];

  const hoverInfo = hoverSeg && (() => {
    const piece = pieces.find((p) => p.id === hoverSeg.pieceId);
    if (!piece || hoverSeg.index >= piece.points.length) return null;
    const info = segmentInfo(piece, hoverSeg.index);
    return { piece, ...info };
  })();

  return (
    <div className="relative h-full w-full bg-[#111114]">
      <svg
        ref={svgRef}
        className={`h-full w-full touch-none select-none ${cursorClass}`}
        onWheel={onWheel}
        onPointerDown={onBackgroundDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setCursor(null)}
        onDoubleClick={() => tool === 'draw' && finishDraft()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern id="grid-minor" width={gridMinor} height={gridMinor} patternUnits="userSpaceOnUse">
            <path d={`M ${gridMinor} 0 L 0 0 0 ${gridMinor}`} fill="none" stroke="#1f1f25" strokeWidth={1 / k} />
          </pattern>
          <pattern id="grid-major" width={gridMinor * 10} height={gridMinor * 10} patternUnits="userSpaceOnUse">
            <rect width={gridMinor * 10} height={gridMinor * 10} fill="url(#grid-minor)" />
            <path d={`M ${gridMinor * 10} 0 L 0 0 0 ${gridMinor * 10}`} fill="none" stroke="#2a2a33" strokeWidth={1.2 / k} />
          </pattern>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${k})`}>
          <rect x={-view.x / k} y={-view.y / k} width={size.w / k} height={size.h / k} fill="url(#grid-major)" pointerEvents="none" />

          {pieces.map((piece) => {
            const fabric = fabricById.get(piece.fabricId);
            const selected = selection.pieceId === piece.id;
            const hovered = hoverPieceId === piece.id;
            const b = bounds(piece.points);
            const mesh = meshes?.get(piece.id);
            return (
              <g key={piece.id} transform={`translate(${piece.offset.x} ${piece.offset.y})`} opacity={piece.visible ? 1 : 0.35}>
                <path
                  d={outlineToSvgPath(piece.points)}
                  fill={fabric?.color ?? '#888'}
                  fillOpacity={selected ? 0.42 : hovered ? 0.34 : 0.22}
                  stroke={selected ? '#c4b5fd' : hovered ? '#a1a1aa' : '#71717a'}
                  strokeWidth={selected ? 2 : 1.25}
                  vectorEffect="non-scaling-stroke"
                  className={tool === 'select' ? 'cursor-move' : undefined}
                  onPointerDown={(e) => onPieceDown(e, piece)}
                  onPointerEnter={() => actions().setHoverPiece(piece.id)}
                  onPointerLeave={() => actions().setHoverPiece(null)}
                />
                {mesh && (
                  <path
                    d={Array.from({ length: mesh.indices.length / 3 }, (_, t) => {
                      const I = mesh.indices;
                      const P = mesh.positions2D;
                      const [a, bb, c] = [I[3 * t], I[3 * t + 1], I[3 * t + 2]];
                      return `M${P[2 * a]} ${P[2 * a + 1]}L${P[2 * bb]} ${P[2 * bb + 1]}L${P[2 * c]} ${P[2 * c + 1]}Z`;
                    }).join('')}
                    fill="none"
                    stroke="#a78bfa"
                    strokeOpacity={0.35}
                    strokeWidth={0.6}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                )}
                <text
                  x={b.cx}
                  y={b.cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.max(2.2, 12 / k)}
                  fill={selected ? '#ede9fe' : '#a1a1aa'}
                  pointerEvents="none"
                  className="font-medium"
                >
                  {piece.name}
                </text>

                {/* Segment-Trefferflächen */}
                {piece.points.map((_, i) => {
                  const isHover = hoverSeg?.pieceId === piece.id && hoverSeg.index === i;
                  const isPending =
                    pendingSeam?.side.pieceId === piece.id &&
                    (() => {
                      const n = piece.points.length;
                      const a = piece.points.findIndex((q) => q.id === pendingSeam.side.fromPointId);
                      const bIdx = piece.points.findIndex((q) => q.id === pendingSeam.side.toPointId);
                      for (let j = a; j !== bIdx; j = (j + 1) % n) if (j === i) return true;
                      return false;
                    })();
                  const active = tool === 'addPoint' || tool === 'curve' || tool === 'seam';
                  return (
                    <g key={piece.points[i].id}>
                      {(isPending || (isHover && active)) && (
                        <path
                          d={segmentPath(piece, i)}
                          fill="none"
                          stroke={isPending ? '#fbbf24' : '#e9d5ff'}
                          strokeWidth={4}
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          pointerEvents="none"
                        />
                      )}
                      <path
                        d={segmentPath(piece, i)}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={12}
                        vectorEffect="non-scaling-stroke"
                        pointerEvents={active || tool === 'select' ? 'stroke' : 'none'}
                        onPointerDown={(e) => onSegmentDown(e, piece, i)}
                        onPointerEnter={() => setHoverSeg({ pieceId: piece.id, index: i })}
                        onPointerLeave={() => setHoverSeg(null)}
                      />
                    </g>
                  );
                })}

                {/* Bezier-Anfasser des gewählten Teils */}
                {selected &&
                  piece.points.map((p, i) => {
                    if (!p.curve) return null;
                    const next = piece.points[(i + 1) % piece.points.length];
                    return (
                      <g key={`h-${p.id}`}>
                        <line x1={p.x} y1={p.y} x2={p.curve.c1.x} y2={p.curve.c1.y} stroke="#f472b6" strokeOpacity={0.7} strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                        <line x1={next.x} y1={next.y} x2={p.curve.c2.x} y2={p.curve.c2.y} stroke="#f472b6" strokeOpacity={0.7} strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                        {(['c1', 'c2'] as const).map((w) => (
                          <rect
                            key={w}
                            x={p.curve![w].x - 3.5 / k}
                            y={p.curve![w].y - 3.5 / k}
                            width={7 / k}
                            height={7 / k}
                            transform={`rotate(45 ${p.curve![w].x} ${p.curve![w].y})`}
                            fill="#f472b6"
                            stroke="#18181b"
                            strokeWidth={1}
                            vectorEffect="non-scaling-stroke"
                            className="cursor-pointer"
                            onPointerDown={(e) => onControlDown(e, piece, p.id, w)}
                          />
                        ))}
                      </g>
                    );
                  })}

                {/* Eckpunkte */}
                {piece.points.map((p) => {
                  const isSel = selection.pointId === p.id;
                  const r = (selected ? (isSel ? 5.5 : 4) : 2.5) / k;
                  return (
                    <circle
                      key={`v-${p.id}`}
                      cx={p.x}
                      cy={p.y}
                      r={r}
                      fill={isSel ? '#fbbf24' : selected ? '#ede9fe' : '#a1a1aa'}
                      stroke="#18181b"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                      className="cursor-pointer"
                      onPointerDown={(e) => onVertexDown(e, piece, p.id)}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Nähte */}
          {seams.map((seam, si) => {
            const pa = pieces.find((p) => p.id === seam.a.pieceId);
            const pb = pieces.find((p) => p.id === seam.b.pieceId);
            if (!pa || !pb) return null;
            const sel = selection.seamId === seam.id;
            return (
              <g key={seam.id}>
                {[{ piece: pa, side: seam.a }, { piece: pb, side: seam.b }].map(({ piece, side }, j) => {
                  const line = seamSidePolyline(piece, side);
                  if (line.length < 2) return null;
                  const mid = polylineMidpoint(line);
                  const pts = line.map((q) => `${q.x + piece.offset.x},${q.y + piece.offset.y}`).join(' ');
                  // Richtungsmarker: Start der Naht (unter Berücksichtigung von "reversed")
                  const start = j === 1 && seam.reversed ? line[line.length - 1] : line[0];
                  return (
                    <g key={j}>
                      <polyline points={pts} fill="none" stroke={seam.color} strokeWidth={sel ? 5 : 3} strokeOpacity={0.9} strokeLinecap="round" strokeDasharray={sel ? undefined : '7 3'} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                      <circle cx={start.x + piece.offset.x} cy={start.y + piece.offset.y} r={3 / k} fill={seam.color} pointerEvents="none" />
                      {/* Nummern-Badge: Klick wählt die Naht */}
                      <g
                        transform={`translate(${mid.x + piece.offset.x} ${mid.y + piece.offset.y})`}
                        className="cursor-pointer"
                        pointerEvents={tool === 'select' ? 'auto' : 'none'}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          actions().select({ seamId: sel ? null : seam.id });
                        }}
                      >
                        <circle r={7 / k} fill="#18181b" stroke={seam.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                        <text fontSize={8.5 / k} textAnchor="middle" dominantBaseline="central" fill={seam.color} className="font-semibold">
                          {si + 1}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Entwurf (Zeichenwerkzeug) */}
          {draft.length > 0 && (
            <g pointerEvents="none">
              <polyline
                points={[...draft, ...(cursor ? [{ x: snap(cursor.x, 0.5), y: snap(cursor.y, 0.5) }] : [])].map((p) => `${p.x},${p.y}`).join(' ')}
                fill="#8b5cf6"
                fillOpacity={0.12}
                stroke="#a78bfa"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                vectorEffect="non-scaling-stroke"
              />
              {draft.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={(i === 0 ? 5 : 3.5) / k} fill={i === 0 ? '#fbbf24' : '#a78bfa'} />
              ))}
            </g>
          )}

          {/* Kantenlänge beim Überfahren */}
          {hoverInfo && (
            <g transform={`translate(${hoverInfo.mid.x + hoverInfo.piece.offset.x} ${hoverInfo.mid.y + hoverInfo.piece.offset.y})`} pointerEvents="none">
              <rect x={-24 / k} y={-22 / k} width={48 / k} height={15 / k} rx={3 / k} fill="#18181bdd" />
              <text y={-14.5 / k} fontSize={9.5 / k} textAnchor="middle" dominantBaseline="central" fill="#e4e4e7">
                {hoverInfo.length.toFixed(1)} cm
              </text>
            </g>
          )}
        </g>
      </svg>

      <EditorToolbar onFit={fitView} />

      <div className="pointer-events-none absolute bottom-2 left-3 flex gap-3 text-[11px] text-zinc-500">
        {cursor && (
          <span className="font-mono">
            x {cursor.x.toFixed(1)} · y {cursor.y.toFixed(1)} cm
          </span>
        )}
        <span>{hintFor(tool, !!pendingSeam, draft.length)}</span>
      </div>
    </div>
  );
}

/** Punkt auf halber Bogenlänge einer Polylinie. */
function polylineMidpoint(line: Vec2[]): Vec2 {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y);
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    const l = Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y);
    if (acc + l >= total / 2) {
      const t = l > 0 ? (total / 2 - acc) / l : 0;
      return { x: line[i - 1].x + (line[i].x - line[i - 1].x) * t, y: line[i - 1].y + (line[i].y - line[i - 1].y) * t };
    }
    acc += l;
  }
  return line[0];
}

function hintFor(tool: string, pending: boolean, draftLen: number): string {
  switch (tool) {
    case 'select':
      return 'Teil/Punkt ziehen · Leerraum ziehen = verschieben · Mausrad = Zoom · Entf = löschen';
    case 'addPoint':
      return 'Auf eine Kante klicken, um einen Punkt einzufügen (und direkt zu ziehen)';
    case 'curve':
      return 'Kante anklicken: gerade ↔ Bezierkurve';
    case 'seam':
      return pending ? 'Zweite Kante wählen · Shift+Klick erweitert die erste Seite · Esc bricht ab' : 'Erste Kante der Naht anklicken';
    case 'draw':
      return draftLen >= 3 ? 'Ersten Punkt anklicken, Doppelklick oder Enter zum Schließen' : 'Klicken, um Eckpunkte zu setzen (Raster 5 mm)';
    default:
      return 'Ziehen zum Verschieben';
  }
}
