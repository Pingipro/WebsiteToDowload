import type { ReactNode } from 'react';

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="border-b border-zinc-800/80 px-4 py-3">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
        {actions}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  digits?: number;
  hint?: string;
  onChange: (v: number) => void;
}

export function Slider({ label, value, min, max, step = 0.01, unit, digits = 2, hint, onChange }: SliderProps) {
  return (
    <label className="block" title={hint}>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className="font-mono text-[11px] text-zinc-400">
          {value.toFixed(digits)}
          {unit && <span className="ml-0.5 text-zinc-500">{unit}</span>}
        </span>
      </div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between text-xs" title={hint}>
      <span className="text-zinc-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-violet-600' : 'bg-zinc-700'}`}
      >
        <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}

export function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span className="shrink-0 text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-violet-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function IconButton({ title, onClick, children, danger }: { title: string; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${danger ? 'text-zinc-400 hover:bg-red-500/20 hover:text-red-300' : 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'}`}
    >
      {children}
    </button>
  );
}
