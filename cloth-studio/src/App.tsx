import { useEffect } from 'react';
import { PatternEditor } from './components/editor2d/PatternEditor';
import { Inspector } from './components/inspector/Inspector';
import { SplitPane } from './components/layout/SplitPane';
import { StatusBar } from './components/layout/StatusBar';
import { TopBar } from './components/layout/TopBar';
import { Viewport3D } from './components/viewport3d/Viewport3D';
import { useSimulationSync } from './physics/useSimulationSync';
import { useStudioStore } from './store/useStudioStore';

export default function App() {
  useSimulationSync();
  useGlobalShortcuts();

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main className="flex min-h-0 flex-1">
        <SplitPane left={<PatternEditor />} right={<Viewport3D />} initial={0.44} />
        <Inspector />
      </main>
      <StatusBar />
    </div>
  );
}

function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
      const st = useStudioStore.getState();
      if (e.code === 'Space') {
        e.preventDefault();
        st.setSim({ running: !st.sim.running });
      } else if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        st.resetSimulation();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
