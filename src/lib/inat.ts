// iNATURALIST (the Social tab, 2026-09-29). Sign-in is OAuth with PKCE: the
// player signs in ON iNaturalist's own page, in the system's sign-in sheet —
// Polygrove never sees a password — and iNaturalist hands back a one-time
// code that only this phone can redeem (the verifier never leaves it).
// The way back is one fixed web address, polygrovedb.pages.dev/inat-callback,
// which forwards the code to the app; that page is the only address
// registered with iNaturalist, whatever phone or build this runs on.
// NOTHING goes to a Polygrove server: the token lives in the phone's secure
// store, and the app talks to iNaturalist directly.
// Docs read: docs.expo.dev v57 webbrowser / crypto / securestore;
// iNaturalist API reference (auth) + api.inaturalist.org/v1 (JWT, 24h).

import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { useSyncExternalStore } from 'react';

const SITE = 'https://www.inaturalist.org';
const API = 'https://api.inaturalist.org/v1';
const cfg = (Constants.expoConfig?.extra?.inat ?? {}) as { clientId?: string; redirectUri?: string };
export const INAT_CLIENT_ID = (cfg.clientId || '').trim();
export const INAT_REDIRECT = cfg.redirectUri || 'https://polygrovedb.pages.dev/inat-callback';
export const inatConfigured = () => INAT_CLIENT_ID.length > 0;

const K_TOKEN = 'polygrove.inat.token';   // the OAuth access token (long-lived)
const K_USER = 'polygrove.inat.user';     // {id, login, name, icon} — for an instant first paint

export type InatUser = { id: number; login: string; name?: string | null; icon?: string | null; observations?: number };
export type InatObs = {
  id: number; uri: string; date: string | null; place: string | null;
  name: string; sci: string | null; photo: string | null; grade: string;
};

let _token: string | null = null;
let _user: InatUser | null = null;
let _jwt: { value: string; at: number } | null = null;
let _loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function loadInat() {
  _loaded ||= (async () => {
    try {
      _token = await SecureStore.getItemAsync(K_TOKEN);
      const u = await SecureStore.getItemAsync(K_USER);
      _user = _token && u ? JSON.parse(u) : null;
    } catch { _token = null; _user = null; }
    emit();
  })();
  return _loaded;
}
export const inatUser = () => _user;
export function useInatUser(): InatUser | null {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => _user, () => _user);
}

const b64url = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomToken = (bytes: number) => b64url(btoa(String.fromCharCode(...Crypto.getRandomBytes(bytes))));

export type SignInResult = { ok: true } | { ok: false; reason: 'not-configured' | 'cancelled' | 'failed'; detail?: string };

export async function signIn(): Promise<SignInResult> {
  if (!inatConfigured()) return { ok: false, reason: 'not-configured' };
  try {
    const verifier = randomToken(48);
    const challenge = b64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
    const back = Linking.createURL('social');                       // where the app listens
    const state = `${randomToken(16)}~${b64url(btoa(back))}`;      // nonce ~ the way back
    const auth = `${SITE}/oauth/authorize?` + new URLSearchParams({
      client_id: INAT_CLIENT_ID, redirect_uri: INAT_REDIRECT, response_type: 'code',
      code_challenge: challenge, code_challenge_method: 'S256', state,
    }).toString();
    const res = await WebBrowser.openAuthSessionAsync(auth, back);
    if (res.type !== 'success' || !res.url) return { ok: false, reason: 'cancelled' };
    const q = new URL(res.url).searchParams;
    if (q.get('error')) return { ok: false, reason: 'cancelled', detail: q.get('error_description') ?? q.get('error') ?? undefined };
    const code = q.get('code');
    if (!code || q.get('state') !== state) return { ok: false, reason: 'failed', detail: 'the reply did not match the request' };
    const tok = await fetch(`${SITE}/oauth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: INAT_CLIENT_ID, code, redirect_uri: INAT_REDIRECT, grant_type: 'authorization_code', code_verifier: verifier,
      }).toString(),
    });
    const tj = await tok.json().catch(() => ({}));
    if (!tok.ok || !tj.access_token) return { ok: false, reason: 'failed', detail: tj.error_description || `iNaturalist answered ${tok.status}` };
    _token = tj.access_token; _jwt = null;
    await SecureStore.setItemAsync(K_TOKEN, _token!);
    await refreshUser();
    return _user ? { ok: true } : { ok: false, reason: 'failed', detail: 'signed in, but the profile could not be read' };
  } catch (e) {
    return { ok: false, reason: 'failed', detail: String((e as Error)?.message ?? e) };
  }
}

export async function signOut() {
  _token = null; _user = null; _jwt = null;
  await Promise.allSettled([SecureStore.deleteItemAsync(K_TOKEN), SecureStore.deleteItemAsync(K_USER)]);
  emit();
}

// the v1 API wants a short-lived JWT, traded for the access token (24h; renewed at 20h)
async function jwt(): Promise<string | null> {
  if (!_token) return null;
  if (_jwt && Date.now() - _jwt.at < 20 * 3600 * 1000) return _jwt.value;
  const r = await fetch(`${SITE}/users/api_token`, { headers: { Authorization: `Bearer ${_token}`, Accept: 'application/json' } });
  if (r.status === 401) { await signOut(); return null; }   // the player revoked access on iNaturalist
  const j = await r.json().catch(() => ({}));
  if (!j.api_token) return null;
  _jwt = { value: j.api_token, at: Date.now() };
  return _jwt.value;
}

export async function refreshUser(): Promise<InatUser | null> {
  const t = await jwt();
  if (!t) return _user;
  const r = await fetch(`${API}/users/me`, { headers: { Authorization: t, Accept: 'application/json' } });
  const u = (await r.json().catch(() => ({}))).results?.[0];
  if (!u) return _user;
  _user = { id: u.id, login: u.login, name: u.name, icon: u.icon_url ?? u.icon, observations: u.observations_count };
  SecureStore.setItemAsync(K_USER, JSON.stringify(_user)).catch(() => {});
  emit();
  return _user;
}

// the player's own observations, newest first
export async function myObservations(limit = 30): Promise<InatObs[]> {
  if (!_user) return [];
  const t = await jwt();
  const r = await fetch(`${API}/observations?user_id=${_user.id}&per_page=${limit}&order=desc&order_by=observed_on`,
    { headers: t ? { Authorization: t, Accept: 'application/json' } : { Accept: 'application/json' } });
  const j = await r.json().catch(() => ({}));
  type Raw = {
    id: number; uri?: string; observed_on?: string | null; place_guess?: string | null; quality_grade?: string;
    species_guess?: string | null; taxon?: { name?: string; rank?: string; preferred_common_name?: string } | null;
    photos?: { url?: string }[];
  };
  return ((j.results ?? []) as Raw[]).map(o => ({
    id: o.id, uri: o.uri || `${SITE}/observations/${o.id}`,
    date: o.observed_on ?? null, place: o.place_guess ?? null,
    name: o.taxon?.preferred_common_name || o.species_guess || o.taxon?.name || 'Unknown',
    sci: o.taxon?.rank === 'species' || o.taxon?.rank === 'subspecies' ? (o.taxon?.name ?? null) : null,
    photo: o.photos?.[0]?.url ? o.photos[0].url.replace('/square.', '/medium.') : null,
    grade: o.quality_grade ?? 'casual',
  }));
}
