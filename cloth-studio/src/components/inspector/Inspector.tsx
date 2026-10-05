import { Cpu, Layers, Palette, Scissors } from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { FabricPanel } from './FabricPanel';
import { PiecePanel } from './PiecePanel';
import { SeamPanel } from './SeamPanel';
import { SimulationPanel } from './SimulationPanel';

type Tab = 'fabric' | 'pieces' | 'seams' | 'sim';

const TABS: { id: Tab; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { id: 'fabric', label: 'Stoff', icon: Palette },
  { id: 'pieces', label: 'Teile', icon: Layers },
  { id: 'seams', label: 'Nähte', icon: Scissors },
  { id: 'sim', label: 'Physik', icon: Cpu },
];

/** Rechte Seitenleiste: Material, Schnittteile, Nähte und Simulationsparameter. */
export function Inspector() {
  const [tab, setTab] = useState<Tab>('fabric');
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-zinc-800 bg-zinc-900/95">
      <nav className="grid grid-cols-4 border-b border-zinc-800 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-col items-center gap-0.5 rounded-md py-1.5 text-[11px] transition-colors ${
              tab === id ? 'bg-zinc-800 text-violet-300' : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {tab === 'fabric' && <FabricPanel />}
        {tab === 'pieces' && <PiecePanel />}
        {tab === 'seams' && <SeamPanel />}
        {tab === 'sim' && <SimulationPanel />}
      </div>
    </aside>
  );
}
