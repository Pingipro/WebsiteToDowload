import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { simulation } from './physics/SimulationController';
import { useStudioStore } from './store/useStudioStore';

// Zugriff für Debugging/Automatisierung in der Browser-Konsole
Object.assign(window, { studio: { simulation, store: useStudioStore } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
