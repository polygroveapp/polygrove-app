// The card's six questions, asked the way the explorer's mock quiz asks them
// (index.html buildQuiz, itself ported from the demo's getQuestion). All the
// facts come from the catalog card: Q1 group · Q2 feeding guild T/F · Q3 size (3 values, 1 correct)
// vs a same-measure opponent · Q4 food web (consumes / consumed by) · Q5
// habitat|origin|biome T/F · Q6 "is this your card?" among look-alikes.
// Deterministic per (card, attempt) so a retry re-rolls the T/F variants.

import { Card, cardByName, getCards, photoFor } from './catalog';

export type Q =
  | { type: 'mc'; label: string; short: string; q: string; opts: string[]; a: string; explain?: string }
  | { type: 'tf'; label: string; short: string; q: string; a: boolean; explain?: string }
  | { type: 'dual'; label: string; short: string;
      s1: { title: string; opts: string[]; a: string }; s2: { title: string; opts: string[]; a: string } }
  // Q6, the capstone swipe (user, 2026-09-26): built from TWO species' data —
  // the correct card, a different (look-alike) species' card, and a CHIMERA:
  // your photo/audio wearing the other species' field note. Anonymized; swipe
  // through, pick yours. Only reading the note separates 'correct' from
  // 'chimera'.
  | { type: 'pick'; label: string; short: string; q: string; cards: PickCard[]; a: PickKey };
export type PickKey = 'correct' | 'other' | 'chimera';
export type PickCard = { key: PickKey; card: Card; noteFrom?: Card };

function hash32(s: string) { let h = 5381; for (const ch of s) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return h >>> 0; }
function mulberry(a: number) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// every deck group, for Q1 distractors when the catalog isn't loaded (offline)
const GROUPS = ['Mammal', 'Bird', 'Reptile', 'Amphibian', 'Fish', 'Insect', 'Arachnid', 'Crustacean', 'Mollusk',
  'Tree', 'Tree/Shrub', 'Shrub', 'Subshrub', 'Perennial Herb', 'Bi/Annual Herb', 'Geophyte', 'Epiphyte', 'Fungus'];

type Q4Side = { question: string; answer: string; options: string[] };
type Q4 = { eats?: Q4Side; eatenBy?: Q4Side };
type Q3 = { measure?: string; bigger: string; smaller: string; opponents: { name: string; size: string; answer: string }[] };

// "0.9 g" → {v: 0.9, unit: 'g'}; "12 mm wingspan" → {v: 12, unit: 'mm wingspan'}
function parseSize(s: unknown): { v: number; unit: string } | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(.*)$/.exec(String(s ?? ''));
  return m ? { v: parseFloat(m[1]), unit: m[2].trim() } : null;
}
// two significant figures, written the way the catalog writes sizes
// (whole numbers plain, otherwise the fewest decimals that show the figure)
function sig2(v: number): string {
  const mag = Math.floor(Math.log10(v)), r = Math.round(v / 10 ** (mag - 1)) * 10 ** (mag - 1);
  return r >= 10 ? String(Math.round(r)) : String(parseFloat(r.toFixed(Math.max(0, 1 - mag))));
}
const fmtSize = (v: number, unit: string) => `${sig2(v)} ${unit}`.trim();
// "45 cm" → "45 cm (18 in)" — metric first, imperial in parentheses (user,
// 2026-09-28: "show both imperial and metric"); the unit word (wingspan)
// stays with the metric figure
export function withImperial(size: string): string {
  const p = parseSize(size);
  if (!p || !(p.v > 0)) return size;
  const u = p.unit.split(' ')[0];
  const imp = u === 'g' ? (p.v >= 453.6 ? `${sig2(p.v / 453.6)} lb` : `${sig2(p.v / 28.35)} oz`)
    : u === 'kg' ? `${sig2(p.v * 2.2046)} lb`
    : u === 'cm' ? (p.v >= 30.48 ? `${sig2(p.v / 30.48)} ft` : `${sig2(p.v / 2.54)} in`)
    : u === 'mm' ? `${sig2(p.v / 25.4)} in`
    : u === 'm' ? `${sig2(p.v * 3.2808)} ft` : null;
  return imp ? `${size} (${imp})` : size;
}

// six slots, null where the card can't ask that question (no look-alikes, say)
export function buildQuiz(card: Card, attempt = 0): (Q | null)[] {
  const rng = mulberry(hash32(`${card.sci}#${attempt}`));
  const shuf = <T,>(arr: T[]) => { const x = [...arr]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  const all = getCards();
  const c = card as Card & { role?: string; falseRole?: string; q3?: Q3; q4?: Q4 };
  const qs: (Q | null)[] = [];

  // Q1 taxonomy
  const groupPool = all.length ? [...new Set(all.map(o => o.group))] : GROUPS;
  const groups = shuf(groupPool.filter(g => g !== c.group)).slice(0, 3);
  qs.push({ type: 'mc', label: 'Q1 · Taxonomy', short: 'Taxonomy', q: `Which group does the ${c.name} belong to?`, opts: shuf([c.group, ...groups]), a: c.group });

  // Q2 feeding guild
  if (c.role && c.falseRole) {
    const t2 = rng() < 0.5;
    qs.push({ type: 'tf', label: 'Q2 · Feeding guild', short: 'Guild', q: `The ${c.name} is ${t2 ? c.role : c.falseRole}.`, a: t2, explain: t2 ? undefined : `The ${c.name} is ${c.role}.` });
  } else qs.push(null);

  // Q3 size: THREE VALUES, one correct (user, 2026-09-28: "just do like 3
  // weights and one should be correct, instead of comparisons"). Decoys sit
  // 2–4× below and above the real figure on a log scale, formatted like the
  // catalog's own size string. The old bigger/smaller opponents stay in the
  // catalog unused.
  const sv = parseSize(c.size);
  if (sv && sv.v > 0) {
    const measure = c.q3?.measure ?? (sv.unit.includes('wingspan') ? 'wingspan' : sv.unit === 'g' ? 'mass' : 'length');
    const ask = measure === 'mass' ? `How much does the ${c.name} weigh, on average?`
      : measure === 'height' ? `How tall does the ${c.name} grow?`
      : measure === 'wingspan' ? `How wide is the ${c.name}'s wingspan?`
      : `How long is the ${c.name}, on average?`;
    const decoy = (f: number) => { let d = fmtSize(sv.v * f, sv.unit), tries = 0;
      while (d === c.size && tries++ < 4) d = fmtSize(sv.v * (f > 1 ? f * 1.5 : f / 1.5), sv.unit); return d; };
    const lo = decoy(1 / (2 + rng() * 2)), hi = decoy(2 + rng() * 2);
    const right = withImperial(c.size as string);
    qs.push({ type: 'mc', label: 'Q3 · Size', short: 'Size', q: ask,
      opts: shuf([right, withImperial(lo), withImperial(hi)]), a: right, explain: `${c.name}: ${right}` });
  } else qs.push(null);

  // Q4 food web
  if (c.q4?.eats && c.q4?.eatenBy) {
    qs.push({ type: 'dual', label: 'Q4 · Food web', short: 'Food web',
      s1: { title: 'Consumes +', opts: c.q4.eats.options, a: c.q4.eats.answer },
      s2: { title: 'Consumed by −', opts: c.q4.eatenBy.options, a: c.q4.eatenBy.answer } });
  } else if (c.q4?.eats || c.q4?.eatenBy) {
    const s = (c.q4.eats || c.q4.eatenBy)!;
    qs.push({ type: 'mc', label: 'Q4 · Food web', short: 'Food web', q: s.question, opts: s.options, a: s.answer });
  } else qs.push(null);

  // Q5 habitat / origin / biome
  if (c.slot5) {
    const pool = all.filter(o => o.slot5type === c.slot5type && o.slot5 && o.slot5 !== c.slot5);
    const t5 = rng() < 0.5;
    const wrong = pool.length ? pool[Math.floor(rng() * pool.length)].slot5 : null;
    const truth = t5 || !wrong;
    const loc = truth ? c.slot5 : wrong;
    const phr = c.slot5type === 'habitat' ? `you would find it in ${loc} habitat`
      : c.slot5type === 'origin' ? `it is native to ${loc}` : `it is found in the ${loc} biome`;
    const short = c.slot5type === 'habitat' ? 'Habitat' : c.slot5type === 'origin' ? 'Origin' : 'Biome';
    qs.push({ type: 'tf', label: `Q5 · ${short}`, short, q: `The ${c.name} — ${phr}.`, a: truth, explain: truth ? undefined : `It's ${c.slot5}.` });
  } else qs.push(null);

  // Q6 is this your card? — the decoys are deck cards (generate_catalog's
  // look-alike tiers), so when they resolve we deal all three as real cards
  if (c.lookAlikes && c.lookAlikes.length >= 2) {
    // a decoy must have a photo — an empty hexagon is a giveaway
    const decoys = c.lookAlikes.map(n => cardByName(n)).filter((d): d is Card => !!d && d.id !== card.id && !!photoFor(d.id));
    const other = decoys.length ? decoys[Math.floor(rng() * decoys.length)] : undefined;
    if (other) {
      const trio: PickCard[] = [
        { key: 'correct', card },
        { key: 'other', card: other },
        { key: 'chimera', card, noteFrom: other },   // your photo, its field note
      ];
      // a wrong pick re-rolls the attempt → a NEW order, never the one just seen
      // (a 3-item shuffle repeats 1 time in 6 by chance — force a change)
      let cards = shuf(trio);
      if (attempt > 0) {
        const prev = buildQuiz(card, attempt - 1)[5];
        const same = (a: PickCard[], b: PickCard[]) => a.every((x, i) => x.key === b[i].key);
        let guard = 0;
        while (prev?.type === 'pick' && same(cards, prev.cards) && guard++ < 6) cards = shuf(trio);
      }
      qs.push({ type: 'pick', label: 'Q6 · Is this your card?', short: 'Your card',
        q: `Which of these three cards is the ${c.name}?`, cards, a: 'correct' });
    } else {
      // decoys not resolvable (offline, unregistered) — the name version
      qs.push({ type: 'mc', label: 'Q6 · Is this your card?', short: 'Your card',
        q: `You drew the ${c.name}. Which of these three look-alike cards is yours?`,
        opts: shuf([c.name, ...c.lookAlikes.slice(0, 2)]), a: c.name });
    }
  } else qs.push(null);

  return qs;
}
