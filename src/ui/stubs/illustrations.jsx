// ZAŚLEPKA ilustracji (wersja awaryjna). Docelowa implementacja: src/ui/illustrations.jsx – ten sam interfejs.
import { ICONS } from '../icon-data.js';
export const ILLUSTRATION_IDS = ['hall-exterior', 'hall-interior', 'hall-green', 'passage', 'factory-archival', 'machine-tool', 'workers', 'steelworks', 'mine', 'glassworks', 'railway', 'lake', 'desert', 'wetland', 'forest', 'park', 'tree', 'river', 'quarry', 'church', 'palace', 'city-street', 'city-panorama', 'tower', 'stage', 'market', 'food', 'workshop', 'kids', 'future-city', 'studio', 'map-old'];
const ICON = { 'hall-exterior': 'factory', 'hall-interior': 'factory', 'hall-green': 'sprout', passage: 'doorOpen', 'factory-archival': 'factory', 'machine-tool': 'cog', workers: 'people', steelworks: 'factory', mine: 'pickaxe', glassworks: 'factory', railway: 'train', lake: 'waves', desert: 'mountain', wetland: 'sprout', forest: 'tree', park: 'tree', tree: 'tree', river: 'waves', quarry: 'mountain', church: 'history', palace: 'history', 'city-street': 'building', 'city-panorama': 'building', tower: 'building', stage: 'music', market: 'store', food: 'utensils', workshop: 'hammer', kids: 'baby', 'future-city': 'sparkles', studio: 'video', 'map-old': 'map' };
const TONES = { duotone: ['#CCE5D8', '#5FB287', '#125930'], archival: ['#E4E1D6', '#A9A694', '#4E4B3E'], color: ['#D9ECF5', '#8CC5A2', '#1F6B45'] };
/** <Illustration id="lake" tone="duotone"|"archival"|"color" /> – SVG wypełniające rodzica (preserveAspectRatio slice). */
export function Illustration({ id, tone = 'duotone', class: cls, title }) {
  const [a, b, c] = TONES[tone] || TONES.duotone; const nodes = ICONS[ICON[id] || 'image'] || ICONS.image; const gid = `ig-${tone}`;
  return (<svg class={`fpz-ill ${cls || ''}`} viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label={title || id}>
    <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color={a} /><stop offset="1" stop-color={b} /></linearGradient></defs>
    <rect width="400" height="300" fill={`url(#${gid})`} /><path d="M0 230c80-30 150-10 220-22s120-24 180-8v100H0z" fill={c} opacity=".28" />
    <g transform="translate(140 80) scale(5)" fill="none" stroke={c} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">{nodes.map(([T, at], i) => <T key={i} {...at} />)}</g>
  </svg>);
}
