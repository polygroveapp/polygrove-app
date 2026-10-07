// Polygrove visual language — lifted from the demo (App.jsx) so the app and the
// explorer speak the same dialect.

export const C = {
  bg: '#0d140d',        // the Camp green — every page sits on it (2026-09-29)
  panel: '#161616',
  card: '#141414',
  line: '#2a2a2a',
  text: '#f5f0e8',      // warm cream
  dim: '#888888',
  faint: '#555555',
  green: '#4CAF50',
  greenSoft: '#81C784',
  gold: '#F5A623',
  yellow: '#ffe14d',
};

export const TROPHIC_COLOR: Record<string, string> = {
  Producer: '#FFD54F',
  Decomposer: '#A0785A',
  Herbivore: '#81C784',
  Omnivore: '#64B5F6',
  Carnivore: '#E57373',
};

export const TROPHIC_ORDER = ['Producer', 'Decomposer', 'Herbivore', 'Omnivore', 'Carnivore'];

// the demo's Geology Mastery System (App.jsx MASTERY) — one tier per quiz
// level cleared. A card starts with NO tier (user, 2026-10-06: a card read
// "Solar" with the Solar question never answered — the six tiers were being
// spread over scores 0–5); Clay is the first question answered right, Solar
// the sixth.
export const MASTERY = [
  { key: 'clay', label: 'Clay', colors: ['#8B5A3C', '#A67B5B', '#8B5A3C'], border: '#A67B5B', glow: 'rgba(166,123,91,0.3)' },
  { key: 'limestone', label: 'Limestone', colors: ['#B8B8A0', '#D4D4BC', '#B8B8A0'], border: '#D4D4BC', glow: 'rgba(212,212,188,0.3)' },
  { key: 'basalt', label: 'Basalt', colors: ['#3D3D3D', '#5A5A5A', '#3D3D3D'], border: '#6A6A6A', glow: 'rgba(90,90,90,0.35)' },
  { key: 'apatite', label: 'Apatite', colors: ['#1A6B5A', '#2EC4A2', '#1A6B5A'], border: '#2EC4A2', glow: 'rgba(46,196,162,0.4)' },
  { key: 'serpentinite', label: 'Serpentinite', colors: ['#2D5A27', '#4AE040', '#1B8A3E'], border: '#4AE040', glow: 'rgba(74,224,64,0.45)' },
  { key: 'solar', label: 'Solar', colors: ['#F5A623', '#FFD700', '#FF8C00'], border: '#FFD700', glow: 'rgba(255,215,0,0.5)' },
] as const;
export const NO_TIER = { key: 'none', label: 'No level', colors: ['#2a2a2a', '#3a3a3a', '#2a2a2a'], border: '#555555', glow: 'rgba(80,80,80,0.3)' } as const;
export type Tier = typeof MASTERY[number] | typeof NO_TIER;
export const ALL_TIERS: readonly Tier[] = [NO_TIER, ...MASTERY];
/** questions answered right at least once → 0 (none) … 6 (Solar) */
export const getLevel = (score: number) => Math.max(0, Math.min(score, MASTERY.length));
export const getTier = (score: number): Tier => (getLevel(score) === 0 ? NO_TIER : MASTERY[getLevel(score) - 1]);

export const F = {
  display: 'DelaGothicOne_400Regular',
  sans: 'DMSans_400Regular',
  sansMed: 'DMSans_500Medium',
  sansBold: 'DMSans_700Bold',
};
