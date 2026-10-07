// WHAT YOU ARE LIKELY TO SEE (the PolygroveDB tab's Pin and Tent filters,
// 2026-10-06): two rankings of the deck from the same GBIF records the range
// maps show — by ecoregion (data/eco_species/<eid>.json) and by 1° cell
// around a spot (data/near/<bx>_<by>.json, 5° blocks). Each gives
// Map<slug, records>, most-recorded first.

const BASE = 'https://polygrovedb.pages.dev/data';
const _eco: Record<number, Promise<[string, number][]>> = {};
export function ecoRanking(eid: number): Promise<[string, number][]> {
  _eco[eid] ||= fetch(`${BASE}/eco_species/${eid}.json`).then(r => (r.ok ? r.json() : [])).catch(() => { delete _eco[eid]; return []; });
  return _eco[eid];
}
type Block = Record<string, [string, number][]>;
const _blocks: Record<string, Promise<Block>> = {};
const block = (bx: number, by: number) => {
  const k = `${bx}_${by}`;
  _blocks[k] ||= fetch(`${BASE}/near/${k}.json`).then(r => (r.ok ? r.json() : {})).catch(() => { delete _blocks[k]; return {}; });
  return _blocks[k];
};
/** the 3×3 cells around the spot; the centre cell counts full, its neighbours half */
export async function pinRanking(lng: number, lat: number): Promise<[string, number][]> {
  const cx = Math.floor(lng), cy = Math.floor(lat);
  const score = new Map<string, number>();
  const wanted: [number, number, number][] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) wanted.push([cx + dx, cy + dy, dx === 0 && dy === 0 ? 1 : 0.5]);
  const blocks = new Map<string, Promise<Block>>();
  for (const [x, y] of wanted) { const k = `${Math.floor(x / 5)}_${Math.floor(y / 5)}`; if (!blocks.has(k)) blocks.set(k, block(Math.floor(x / 5), Math.floor(y / 5))); }
  const loaded = new Map<string, Block>();
  for (const [k, p] of blocks) loaded.set(k, await p);
  for (const [x, y, w] of wanted) {
    const b = loaded.get(`${Math.floor(x / 5)}_${Math.floor(y / 5)}`);
    for (const [slug, n] of b?.[`${x}_${y}`] ?? []) score.set(slug, (score.get(slug) ?? 0) + n * w);
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]);
}
