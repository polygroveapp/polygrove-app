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
const _shards: Record<number, Promise<Record<string, ShardRow[]>>> = {};
const _notes: Record<string, string | null> = {};

// every GloBI interaction row for a species — e.g.
// ['GloBI', 'preysOn — 1710 partners, 6980 records', 'top: Gonomyia lucidula, …']
export async function globiRecords(sci: string): Promise<{ fact: string; value: string; derived: boolean }[]> {
  const sh = djb2(sci);
  _shards[sh] ||= fetch(`${BASE}/${sh}.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  const rows = (await _shards[sh])[sci] || [];
  return rows
    .filter(r => String(r[0]).startsWith('GloBI'))
    .map(r => ({ fact: String(r[1]), value: String(r[2]), derived: String(r[0]).includes('derived') }));
}

export async function fieldNote(sci: string): Promise<string | null> {
  if (sci in _notes) return _notes[sci];
  const sh = djb2(sci);
  _shards[sh] ||= fetch(`${BASE}/${sh}.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  const shard = await _shards[sh];
  const rows = shard[sci] || [];
  const lead = rows.find(r => r[0] === 'Wikipedia extracts (sourced)' && String(r[1]).startsWith('lead sentence'));
  const note = lead ? String(lead[2]).replace(/\(\s*[;,]\s*/g, '(').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ') : null;
  _notes[sci] = note;
  return note;
}
