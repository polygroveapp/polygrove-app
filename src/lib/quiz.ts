// The card's six questions, asked the way the explorer's mock quiz asks them
// (index.html buildQuiz, itself ported from the demo's getQuestion). All the
// facts come from the catalog card: Q1 group · Q2 feeding guild T/F · Q3 size (3 real sizes, 1 correct)
// vs a same-measure opponent · Q4 food web (consumes / consumed by) · Q5
// habitat|origin|biome T/F · Q6 "is this your card?" among look-alikes.
// Deterministic per (card, attempt) so a retry re-rolls the T/F variants.

import { Card, cardByName, fmtImperial, fmtSize as niceMetric, getCards, parseSize as parseUnit, photoFor, sizeFrac, sizeRange } from './catalog';

export type Q =
  // rows (the size question): per option, an example species of that size and where it sits on the group's scale
  | { type: 'mc'; label: string; short: string; q: string; opts: string[]; a: string; explain?: string; rows?: Record<string, { eg?: string; egId?: string; frac: number | null }> }
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

// the plant-side groups, for when the catalog isn't loaded (offline)
const PLANT_GROUPS = ['Tree', 'Tree/Shrub', 'Shrub', 'Subshrub', 'Perennial Herb', 'Bi/Annual Herb', 'Geophyte', 'Epiphyte', 'Plant', 'Fungus'];

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
// "2140.8 g" → "2.1 kg | 4.7 lb": the card's own relatable format (user,
// 2026-10-06: "make these numbers relatable in general") — metric in a unit
// that reads, the imperial twin after a bar; a wingspan keeps its word
export function withImperial(size: string): string {
  const p = parseUnit(size);
  if (!p) return size;
  const word = /wingspan/i.test(size) ? ' wingspan' : '';
  return `${niceMetric(p.v, p.unit)}${word} ${fmtImperial(p.v, p.unit)}`;
}

// six slots, null where the card can't ask that question (no look-alikes, say)
export function buildQuiz(card: Card, attempt = 0): (Q | null)[] {
  const rng = mulberry(hash32(`${card.sci}#${attempt}`));
  const shuf = <T,>(arr: T[]) => { const x = [...arr]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  const all = getCards();
  const c = card as Card & { role?: string; falseRole?: string; q3?: Q3; q4?: Q4 };
  const qs: (Q | null)[] = [];

  // Q1 taxonomy
  // LIKE WITH LIKE (user, 2026-10-07: "if it's a producer then the taxonomy is
  // only plant related, like bi/annual, or decomposer. if not a plant then do
  // any other category"): a plant or fungus is offered only plant and fungus
  // groups, an animal only animal groups — "Bullsnake: Bi/Annual Herb?" was a
  // free elimination. A group counts as plant-side when its cards are
  // producers or decomposers; one-card groups (Ginkgoopsida, Worm) are never
  // offered as decoys.
  const GREEN = (t?: string) => t === 'Producer' || t === 'Decomposer';
  const sizes = new Map<string, number>(), greenGroups = new Set<string>(PLANT_GROUPS);
  for (const o of all) { sizes.set(o.group, (sizes.get(o.group) ?? 0) + 1); if (GREEN(o.trophic)) greenGroups.add(o.group); }
  const mine = GREEN(c.trophic) || greenGroups.has(c.group);
  // …and FUNGUS is offered on both sides (user, same day): a fungus is neither, and a fair guess for either
  const groupPool = [...new Set([...(all.length ? [...sizes.keys()].filter(g => (sizes.get(g) ?? 0) >= 5) : GROUPS).filter(g => greenGroups.has(g) === mine), 'Fungus'])];
  const groups = shuf(groupPool.filter(g => g !== c.group)).slice(0, 3);
  qs.push({ type: 'mc', label: 'Q1 · Taxonomy', short: 'Taxonomy', q: `Which group does the ${c.name} belong to?`, opts: shuf([c.group, ...groups]), a: c.group });

  // Q2 feeding guild
  if (c.role && c.falseRole) {
    const t2 = rng() < 0.5;
    qs.push({ type: 'tf', label: 'Q2 · Feeding guild', short: 'Guild', q: `The ${c.name} is ${t2 ? c.role : c.falseRole}.`, a: t2, explain: t2 ? undefined : `The ${c.name} is ${c.role}.` });
  } else qs.push(null);

  // Q3 size: VALUES, one correct (user, 2026-09-28: "just do like 3
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
    // FIVE SIZES, SMALLEST AT THE TOP, EACH A REAL SPECIES (user, 2026-10-07:
    // "smallest to largest from top to bottom … have every option be an example of
    // a species", each with the card's scale bar beside it; three for an hour in
    // between). The wrong sizes are the real sizes of other cards in
    // the same group, picked near steps of 1.9–2.6× below and above the answer and
    // never within 1.5× of one another, each named ("like a Mallard"). The right
    // one is named after its nearest neighbour in size, when one is within 12% —
    // never after itself. Where the deck has no species near a step (or offline),
    // that step is a plain figure, as the three options used to be.
    const right = withImperial(c.size as string);
    const cs = parseUnit(c.size);
    const range = cs ? sizeRange(c.group, cs.unit) : null;
    // examples with a common name only ("like a Red Fox", not "like a Metachirus nudicaudatus"), unless the group has none
    const same = cs ? getCards().filter(o => o.group === c.group && o.sci !== c.sci && parseUnit(o.size)?.unit === cs.unit) : [];
    const named = same.filter(o => o.name.toLowerCase() !== o.sci.toLowerCase());
    const pool = (named.length >= 8 ? named : same).map(o => ({ id: o.id, name: o.name, size: o.size as string, v: parseUnit(o.size)!.v }));
    type Row = { label: string; v: number; eg?: string; egId?: string };
    const rows: Row[] = [{ label: right, v: sv.v }];
    const far = (v: number) => rows.every(r => Math.max(v, r.v) / Math.min(v, r.v) >= 1.5);
    const near = pool.filter(o => Math.max(o.v, sv.v) / Math.min(o.v, sv.v) <= 1.12 && withImperial(o.size) !== right)
      .sort((a, b) => Math.abs(Math.log(a.v / sv.v)) - Math.abs(Math.log(b.v / sv.v)))[0];
    if (near) { rows[0].eg = near.name; rows[0].egId = near.id; }
    const N = 5, at = Math.floor(rng() * N), step = 1.9 + rng() * 0.7;   // five of them (user, 2026-10-07, after three); where the answer sits among them
    for (let i = 0; i < N; i++) {
      if (i === at) continue;
      const target = sv.v * step ** (i - at);
      const pick = pool.filter(o => far(o.v) && Math.max(o.v, target) / Math.min(o.v, target) <= 1.45 && !rows.some(r => r.label === withImperial(o.size)))
        .sort((a, b) => Math.abs(Math.log(a.v / target)) - Math.abs(Math.log(b.v / target)))[0];
      if (pick) rows.push({ label: withImperial(pick.size), v: pick.v, eg: pick.name, egId: pick.id });
      else { let lbl = withImperial(fmtSize(target, sv.unit)), f = target, tries = 0;
        while (rows.some(r => r.label === lbl) && tries++ < 4) { f *= i < at ? 1 / 1.4 : 1.4; lbl = withImperial(fmtSize(f, sv.unit)); }
        rows.push({ label: lbl, v: f }); }
    }
    rows.sort((a, b) => a.v - b.v);
    qs.push({ type: 'mc', label: 'Q3 · Size', short: 'Size', q: ask,
      opts: rows.map(r => r.label), a: right, explain: `${c.name}: ${right}`,
      // the scale bar per option: where that size sits between the group's smallest and largest (log scale)
      rows: Object.fromEntries(rows.map(r => [r.label, { eg: r.eg, egId: r.egId, frac: range ? sizeFrac(r.v, range) : null }])) });
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
