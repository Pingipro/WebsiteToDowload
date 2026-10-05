import { useCallback, useRef, useState, type ReactNode } from 'react';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  /** Anfangsanteil des linken Bereichs (0..1). */
  initial?: number;
  min?: number;
  max?: number;
}

/** Horizontales, per Maus/Touch verschiebbares Split-Pane-Layout. */
export function SplitPane({ left, right, initial = 0.45, min = 0.18, max = 0.82 }: SplitPaneProps) {
  const [ratio, setRatio] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !container.current) return;
      const rect = container.current.getBoundingClientRect();
      setRatio(Math.min(max, Math.max(min, (e.clientX - rect.left) / rect.width)));
    },
    [dragging, min, max],
  );

  return (
    <div ref={container} className="relative flex h-full min-w-0 flex-1">
      <div className="relative h-full min-w-0 overflow-hidden" style={{ width: `${ratio * 100}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        title="Bereiche anpassen (Doppelklick: zurücksetzen)"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragging(false)}
        onDoubleClick={() => setRatio(initial)}
        className={`group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-zinc-800 transition-colors hover:bg-violet-500/70 ${dragging ? 'bg-violet-500' : ''}`}
      >
        <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
        <div className="absolute left-1/2 top-1/2 h-8 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-zinc-500 group-hover:bg-white" />
      </div>
      <div className="relative h-full min-w-0 flex-1 overflow-hidden">{right}</div>
      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" onPointerMove={onPointerMove} onPointerUp={() => setDragging(false)} />}
    </div>
  );
}
