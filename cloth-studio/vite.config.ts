import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `base: './'` erlaubt das Hosten des Builds in einem beliebigen Unterordner
// (z. B. GitHub Pages unter /cloth-studio/).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 5000,
  },
});
