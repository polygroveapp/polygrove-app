// Polygrove visual language — lifted from the demo (App.jsx) so the app and the
// explorer speak the same dialect.

export const C = {
  bg: '#0d0d0d',
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

export const F = {
  display: 'DelaGothicOne_400Regular',
  sans: 'DMSans_400Regular',
  sansMed: 'DMSans_500Medium',
  sansBold: 'DMSans_700Bold',
};
