// Field notes come from the site's dossier shards (djb2(sci) % 256), same as the
// explorer: the 'lead sentence' row of 'Wikipedia extracts (sourced)' — which is
// the article's SECOND sentence since 2026-09-25 (the interesting one).

const BASE = 'https://polygrovedb.pages.dev/data/dossier';

function djb2(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) >>> 0;
  return h % 256;
}

type ShardRow = [string, string, string]; // [source, fact, value]
export type GlobiRow = { fact: string; value: string; derived: boolean };
const _shards: Record<number, Promise<Record<string, ShardRow[]>>> = {};
const _notes: Record<string, string | null> = {};
const _globiSeed: Record<string, GlobiRow[]> = {};

// offline snapshots (offline.ts) pre-fill the caches so collected/queued cards
// read their field note + GloBI rows with no network. Snapshot data wins —
// a collected card is a snapshot of what you caught, not synced.
export function seedDossier(sci: string, note: string | null, globi: GlobiRow[]) {
  if (!(sci in _notes)) _notes[sci] = note;
  if (!_globiSeed[sci] && globi.length) _globiSeed[sci] = globi;
}

// every GloBI interaction row for a species — e.g.
// ['GloBI', 'preysOn — 1710 partners, 6980 records', 'top: Gonomyia lucidula, …']
export async function globiRecords(sci: string): Promise<GlobiRow[]> {
  if (_globiSeed[sci]) return _globiSeed[sci];
  const sh = djb2(sci);
  _shards[sh] ||= fetch(`${BASE}/${sh}.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  const rows = (await _shards[sh])[sci] || [];
  return rows
    .filter(r => String(r[0]).startsWith('GloBI'))
    .map(r => ({ fact: String(r[1]), value: String(r[2]), derived: String(r[0]).includes('derived') }));
}

export async function fieldNote(sci: string): Promise<string | null> {
  if (sci in _notes) return _notes[sci];
  return fieldNoteFresh(sci);
}
/** the note as the live shard has it now — past any seeded/snapshotted value */
export async function fieldNoteFresh(sci: string): Promise<string | null> {
  const sh = djb2(sci);
  _shards[sh] ||= fetch(`${BASE}/${sh}.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  const shard = await _shards[sh];
  const rows = shard[sci] || [];
  const lead = rows.find(r => r[0] === 'Wikipedia extracts (sourced)' && String(r[1]).startsWith('lead sentence'));
  const note = lead ? String(lead[2]).replace(/\(\s*[;,]\s*/g, '(').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ') : null;
  _notes[sci] = note;
  return note;
}
