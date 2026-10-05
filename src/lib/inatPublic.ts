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
  species_guess?: string | null; taxon?: { name?: string; rank?: string; preferred_common_name?: string } | null;
  photos?: { url?: string; license_code?: string | null; attribution?: string }[];
  user?: RawUser;
  geojson?: { coordinates?: [number, number] } | null;   // [lng, lat], as iNaturalist publishes it
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

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`iNaturalist answered ${r.status}`);
  return r.json();
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
export type Spot = { id: number; uri: string; date: string | null; name: string; sci: string | null; lng: number | null; lat: number | null };
export async function gradedOf(userId: number, grade: 'research' | 'needs_id', page = 1, perPage = 200): Promise<{ list: Spot[]; total: number }> {
  const j = await get<{ results: RawObs[]; total_results: number }>(
    `/observations?user_id=${userId}&quality_grade=${grade}&per_page=${perPage}&page=${page}&order=asc&order_by=id`);
  const list = (j.results ?? []).map((o): Spot => {
    const c = o.geojson?.coordinates;
    return {
      id: o.id, uri: o.uri || `https://www.inaturalist.org/observations/${o.id}`, date: o.observed_on ?? null,
      name: o.taxon?.preferred_common_name || o.species_guess || o.taxon?.name || 'Unknown', sci: binomial(o.taxon),
      lng: c && Number.isFinite(c[0]) ? c[0] : null, lat: c && Number.isFinite(c[1]) ? c[1] : null,
    };
  });
  return { list, total: j.total_results ?? 0 };
}
