// WHICH ECOREGION IS THIS SPOT IN? (Sightings, 2026-10-05) — worked out on
// the phone: the ecoregions whose bounding box holds the point are tried
// smallest first, each against its high-detail outline (the same
// data/eco_hd/<id>.json files the map draws), holes respected — an enclave of
// mountain forest inside a desert is the forest, not the desert.
// The coordinates never leave the phone; all the site sees is which outline
// files were asked for, as when the map is looked at.

import { loadEcoMeta } from './ecoregions';

const HD = (eid: number) => `https://polygrovedb.pages.dev/data/eco_hd/${eid}.json`;
type Ring = number[][];
type Poly = Ring[];   // outer ring, then holes
const _polys = new Map<number, Poly[]>();
const _inflight = new Map<number, Promise<Poly[]>>();
const _spots = new Map<string, number | null>();

const inRing = (x: number, y: number, r: Ring) => {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inPoly = (x: number, y: number, p: Poly) => p.length > 0 && inRing(x, y, p[0]) && !p.slice(1).some(h => inRing(x, y, h));

// a missing file is an ecoregion with no outline (skipped); a failed request
// THROWS, so a sync stops rather than recording "nowhere" for a spot it
// simply could not look up
function polysOf(eid: number): Promise<Poly[]> {
  const have = _polys.get(eid);
  if (have) return Promise.resolve(have);
  let p = _inflight.get(eid);
  if (!p) {
    p = fetch(HD(eid)).then(async r => {
      if (r.status === 404) return [] as Poly[];
      if (!r.ok) throw new Error(`outline ${eid}: ${r.status}`);
      const fc = await r.json();
      const out: Poly[] = [];
      for (const f of (fc.features ?? [fc])) {
        const g = f?.geometry;
        if (g?.type === 'Polygon') out.push(g.coordinates);
        else if (g?.type === 'MultiPolygon') out.push(...g.coordinates);
      }
      return out;
    }).then(polys => {
      _polys.set(eid, polys);
      if (_polys.size > 60) _polys.delete(_polys.keys().next().value as number);   // oldest out
      return polys;
    }).finally(() => { _inflight.delete(eid); });
    _inflight.set(eid, p);
  }
  return p;
}

export async function ecoregionAt(lng: number, lat: number): Promise<number | null> {
  const key = `${lng.toFixed(4)},${lat.toFixed(4)}`;
  if (_spots.has(key)) return _spots.get(key) ?? null;
  const meta = await loadEcoMeta();
  const cands = Object.entries(meta)
    .filter(([, m]) => lng >= m.bbox[0] && lng <= m.bbox[2] && lat >= m.bbox[1] && lat <= m.bbox[3])
    .sort((a, b) => (a[1].bbox[2] - a[1].bbox[0]) * (a[1].bbox[3] - a[1].bbox[1]) - (b[1].bbox[2] - b[1].bbox[0]) * (b[1].bbox[3] - b[1].bbox[1]))
    .map(([id]) => Number(id));
  let hit: number | null = null;
  for (const eid of cands) {
    const polys = await polysOf(eid);
    if (polys.some(p => inPoly(lng, lat, p))) { hit = eid; break; }
  }
  _spots.set(key, hit);
  return hit;
}
