import * as THREE from 'three';
import type { TexturePattern } from '../types';

const cache = new Map<string, THREE.CanvasTexture>();

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount)));
  return `#${c.getHexString()}`;
}

/**
 * Prozedurale Stofftexturen (Canvas). Eine Kachel entspricht `textureScale` cm,
 * die UVs der Stoffmeshes sind in cm / textureScale angegeben.
 */
export function getFabricTexture(pattern: TexturePattern, color: string): THREE.CanvasTexture | null {
  if (pattern === 'none') return null;
  const key = `${pattern}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, S, S);
  const dark = shade(color, -0.12);
  const light = shade(color, 0.08);

  switch (pattern) {
    case 'stripes': {
      g.fillStyle = shade(color, -0.25);
      g.fillRect(0, 0, S, S * 0.3);
      g.fillStyle = light;
      g.fillRect(0, S * 0.55, S, S * 0.06);
      break;
    }
    case 'checks': {
      g.globalAlpha = 0.45;
      g.fillStyle = shade(color, -0.3);
      g.fillRect(0, 0, S / 2, S);
      g.fillRect(0, 0, S, S / 2);
      g.globalAlpha = 0.6;
      g.fillStyle = shade(color, 0.25);
      g.fillRect(S * 0.72, 0, S * 0.05, S);
      g.fillRect(0, S * 0.72, S, S * 0.05);
      g.globalAlpha = 1;
      break;
    }
    case 'denim': {
      // Köperbindung: diagonale Grate + Rauschen
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const d = (x + y) % 8 < 4;
          const n = Math.random() * 0.18;
          g.fillStyle = d ? shade(color, -0.06 - n * 0.4) : shade(color, 0.05 + n * 0.3);
          g.fillRect(x, y, 1, 1);
        }
      break;
    }
    case 'dots': {
      g.fillStyle = shade(color, 0.45);
      for (const [x, y] of [[0.25, 0.25], [0.75, 0.75]]) {
        g.beginPath();
        g.arc(x * S, y * S, S * 0.09, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'knit': {
      // Maschenbild (V-Struktur)
      const cols = 8;
      const rows = 8;
      const w = S / cols;
      const h = S / rows;
      g.lineWidth = w * 0.32;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const x = c * w;
          const y = r * h;
          g.strokeStyle = dark;
          g.beginPath();
          g.moveTo(x + w * 0.1, y);
          g.lineTo(x + w * 0.5, y + h * 0.9);
          g.lineTo(x + w * 0.9, y);
          g.stroke();
          g.strokeStyle = light;
          g.lineWidth = w * 0.12;
          g.beginPath();
          g.moveTo(x + w * 0.2, y + h * 0.05);
          g.lineTo(x + w * 0.5, y + h * 0.7);
          g.stroke();
          g.lineWidth = w * 0.32;
        }
      break;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}
