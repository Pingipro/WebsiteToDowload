let counter = 0;

export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const SEAM_COLORS = ['#f97316', '#22d3ee', '#a3e635', '#e879f9', '#facc15', '#60a5fa', '#f87171', '#34d399', '#c084fc', '#fb7185', '#2dd4bf', '#fbbf24'];
