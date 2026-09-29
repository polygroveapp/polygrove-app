// BUYING A CARD (Social, 2026-09-29: "you just buy cards with 10 sol"). A
// sighting someone shared — any species that is a card in the deck — can be
// bought for 10 Sol and journaled.
// WHERE IT GOES: decks are per ecoregion. The card joins your CAMP's deck when
// the species lives there; otherwise it joins the species' own first
// ecoregion, waiting in that journal for when you camp there.

import { Card, getCards, photoRemote, framingFor } from './catalog';
import { addToCollection, owns } from './collection';
import { fieldNote, globiRecords } from './dossier';
import { currentEco, ecoMeta } from './ecoregions';
import { snapshotStashed } from './offline';
import { sol, spendSol } from './sol';

export const CARD_PRICE = 10;

let _bySci: Map<string, Card> | null = null;
let _n = 0;
export function cardForSpecies(sci: string | null | undefined): Card | undefined {
  if (!sci) return undefined;
  const all = getCards();
  if (!_bySci || _n !== all.length) { _bySci = new Map(all.map(c => [c.sci.toLowerCase(), c])); _n = all.length; }
  return _bySci.get(sci.toLowerCase());
}

export const homeOf = (card: Card): number | null => {
  const ecos = (card.ecoregions as number[] | undefined) ?? [];
  const camp = currentEco()?.eid;
  if (camp != null && ecos.includes(camp)) return camp;
  return ecos.length ? ecos[0] : camp ?? null;
};


export type Bought =
  | { ok: true; eid: number; inCamp: boolean; where: string }
  | { ok: false; reason: 'sol' | 'owned' | 'nowhere' };

export function buyCard(card: Card): Bought {
  const eid = homeOf(card);
  if (eid == null) return { ok: false, reason: 'nowhere' };
  if (owns(eid, card.species_id)) return { ok: false, reason: 'owned' };
  if (sol() < CARD_PRICE) return { ok: false, reason: 'sol' };
  spendSol(CARD_PRICE);
  addToCollection(eid, card);
  // journaled cards are readable offline forever: photo, note and food web are fetched and kept
  snapshotStashed({ card, note: null, globi: [], photoUrl: photoRemote(card.id, 500), frame: framingFor(card.id) });
  fieldNote(card.sci).catch(() => {}); globiRecords(card.sci).catch(() => {});
  const camp = currentEco();
  return { ok: true, eid, inCamp: camp?.eid === eid, where: camp?.eid === eid ? camp.name : ecoMeta(eid)?.name ?? 'its home ecoregion' };
}
