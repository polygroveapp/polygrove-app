// iNATURALIST, PUBLIC ONLY (Social, 2026-09-29). No sign-in: iNaturalist
// approves third-party sign-in by hand and that is for later (lib/inat.ts
// keeps the OAuth code). Everything here is what anyone can read without an
// account: finding people, and their public observations.
// The phone talks to iNaturalist directly; nothing goes to a Polygrove server.
// PHOTOS: an observation's photo is only shown when its owner gave it a
// licence (CC…), and always with their credit line. All-rights-reserved
// photos are never displayed, and such a sighting cannot become a card.

const API = 'https://api.inaturalist.org/v1';

export type Naturalist = { id: number; login: string; name: string | null; icon: string | null; observations: number; species?: number };
export type Sighting = {
  id: number; uri: string; date: string | null; place: string | null; grade: string;
  name: string; sci: string | null;
  photo: string | null; credit: string | null;        // null when the photo is all-rights-reserved
  license: string | null;                             // the photo's licence code as iNaturalist gives it ("cc-by-nc", "cc0"…)
  by: { id: number; login: string; icon: string | null };
};

type RawUser = { id: number; login: string; name?: string | null; icon_url?: string | null; icon?: string | null; observations_count?: number; species_count?: number };
type RawObs = {
  id: number; uri?: string; observed_on?: string | null; place_guess?: string | null; quality_grade?: string;
  species_guess?: string | null; taxon?: { name?: string; rank?: string; preferred_common_name?: string; iconic_taxon_name?: string | null } | null;
  photos?: { url?: string; license_code?: string | null; attribution?: string }[];
  user?: RawUser;
  geojson?: { coordinates?: [number, number] } | null;   // [lng, lat], as iNaturalist publishes it
  num_identification_agreements?: number;
};

const person = (u: RawUser): Naturalist => ({
  id: u.id, login: u.login,
  name: u.name && u.name !== `@${u.login}` ? u.name : null,
  icon: u.icon_url ?? u.icon ?? null, observations: u.observations_count ?? 0, species: u.species_count,
});

// the species a card could stand for: a species name, or a subspecies' binomial
const binomial = (t: RawObs['taxon']) => {
  if (!t?.name || !t.rank) return null;
  if (t.rank === 'species') return t.name;
  if (['subspecies', 'variety', 'form', 'hybrid'].includes(t.rank)) return t.name.split(' ').slice(0, 2).join(' ');
  return null;
};

const sighting = (o: RawObs): Sighting => {
  const p = o.photos?.find(x => x.url && x.license_code) ?? null;
  return {
    id: o.id, uri: o.uri || `https://www.inaturalist.org/observations/${o.id}`,
    date: o.observed_on ?? null, place: o.place_guess ?? null, grade: o.quality_grade ?? 'casual',
    name: o.taxon?.preferred_common_name || o.species_guess || o.taxon?.name || 'Unknown',
    sci: binomial(o.taxon),
    photo: p?.url ? p.url.replace('/square.', '/medium.') : null,
    credit: p?.attribution ?? null,
    license: p?.license_code ?? null,
    by: { id: o.user?.id ?? 0, login: o.user?.login ?? '', icon: o.user?.icon_url ?? o.user?.icon ?? null },
  };
};

// iNaturalist asks for no more than ~1 request a second and answers 429 when
// pushed; a 2,000-observation account is ten pages plus the lookups behind
// them, which hit that (2026-10-05 stress test). So: a beat between requests,
// and on 429 / 5xx / a dropped connection wait and try again, up to five
// times, honouring Retry-After. Only a persistent failure throws.
let _last = 0;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
async function get<T>(path: string): Promise<T> {
  let wait = 1500;
  for (let attempt = 0; ; attempt++) {
    const gap = 1100 - (Date.now() - _last);
    if (gap > 0) await sleep(gap);
    _last = Date.now();
    let r: Response | null = null;
    try { r = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } }); } catch { /* no connection: retry below */ }
    if (r?.ok) return r.json();
    if (r && r.status < 500 && r.status !== 429) throw new Error(`iNaturalist answered ${r.status}`);
    if (attempt >= 4) throw new Error(r ? `iNaturalist answered ${r.status}` : 'iNaturalist could not be reached');
    const after = Number(r?.headers.get('retry-after')) * 1000;
    await sleep(after > 0 ? Math.min(after, 60000) : wait);
    wait = Math.min(wait * 2, 20000);
  }
}

export async function searchNaturalists(q: string): Promise<Naturalist[]> {
  if (q.trim().length < 2) return [];
  const j = await get<{ results: RawUser[] }>(`/users/autocomplete?q=${encodeURIComponent(q.trim())}&per_page=12`);
  return (j.results ?? []).map(person);
}

export async function naturalist(login: string): Promise<Naturalist | null> {
  const j = await get<{ results: RawUser[] }>(`/users/${encodeURIComponent(login)}`);
  return j.results?.[0] ? person(j.results[0]) : null;
}

// someone's observations, newest first
export async function sightingsOf(userId: number, page = 1, perPage = 30): Promise<{ list: Sighting[]; total: number }> {
  const j = await get<{ results: RawObs[]; total_results: number }>(
    `/observations?user_id=${userId}&per_page=${perPage}&page=${page}&order=desc&order_by=observed_on`);
  return { list: (j.results ?? []).map(sighting), total: j.total_results ?? 0 };
}

// the people you follow, together, newest first
export async function feed(userIds: number[], perPage = 40): Promise<Sighting[]> {
  if (!userIds.length) return [];
  const j = await get<{ results: RawObs[] }>(
    `/observations?user_id=${userIds.slice(0, 50).join(',')}&per_page=${perPage}&order=desc&order_by=created_at`);
  return (j.results ?? []).map(sighting);
}

// YOUR SIGHTINGS (2026-10-05): one grade of someone's observations, oldest
// first, with the location iNaturalist makes PUBLIC — for a threatened
// species or a hidden one that is a deliberately blurred spot (or none).
// 'research' = the community has confirmed the identification; 'needs_id' =
// still waiting for that.
// photo: YOUR OWN observation's photo, whatever its licence (user, 2026-10-05:
// "make sure every card has the custom photo") — these are the account
// holder's own pictures, shown back to them; the credit line still carries
// iNaturalist's attribution text. (The parked Social feed, which showed OTHER
// people's photos, kept the licensed-only rule above.)
export type Spot = {
  id: number; uri: string; date: string | null; name: string; sci: string | null; lng: number | null; lat: number | null;
  place: string | null; photo: string | null; credit: string | null; agree: number;
  iconic: string | null;   // iNaturalist's broad group — Plantae, Fungi, Aves, Insecta… — for a role when the database has none
};
export type Grade = 'research' | 'needs_id';
const spotOf = (o: RawObs): Spot => {
  const c = o.geojson?.coordinates;
  const ph = o.photos?.find(x => x.url) ?? null;
  return {
      place: o.place_guess ?? null, photo: ph?.url ? ph.url.replace('/square.', '/medium.') : null,
      credit: ph?.attribution ?? null, agree: o.num_identification_agreements ?? 0, iconic: o.taxon?.iconic_taxon_name ?? null,
      id: o.id, uri: o.uri || `https://www.inaturalist.org/observations/${o.id}`, date: o.observed_on ?? null,
      name: o.taxon?.preferred_common_name || o.species_guess || o.taxon?.name || 'Unknown', sci: binomial(o.taxon),
      lng: c && Number.isFinite(c[0]) ? c[0] : null, lat: c && Number.isFinite(c[1]) ? c[1] : null,
    };
};
// just the count of one grade — one tiny request (per_page=0), to tell whether a
// full pass is worth it (2026-10-06: the app re-checked a 4,500-sighting
// account every ten minutes, two minutes a time)
export async function countOf(userId: number, grade: Grade): Promise<number> {
  const j = await get<{ total_results: number }>(`/observations?user_id=${userId}&quality_grade=${grade}&per_page=0`);
  return j.total_results ?? 0;
}
export async function gradedOf(userId: number, grade: Grade, page = 1, perPage = 200, order: 'asc' | 'desc' = 'asc'): Promise<{ list: Spot[]; total: number }> {
  const j = await get<{ results: RawObs[]; total_results: number }>(
    `/observations?user_id=${userId}&quality_grade=${grade}&per_page=${perPage}&page=${page}&order=${order}&order_by=id`);
  return { list: (j.results ?? []).map(spotOf), total: j.total_results ?? 0 };
}
// one observation, for the map's ✕ popup (2026-10-05)
export async function observation(id: number): Promise<(Spot & { grade: string }) | null> {
  const j = await get<{ results: RawObs[] }>(`/observations/${id}`);
  const o = j.results?.[0];
  return o ? { ...spotOf(o), grade: o.quality_grade ?? 'casual' } : null;
}
