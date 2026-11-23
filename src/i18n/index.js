// Locale: English or German. Game tables are swapped IN PLACE, so every consumer (engine log lines,
// HUD, inspector, advisor) reads the active language without any rewiring. English originals are
// snapshotted on first use. Interface strings go through t(english) with a lazy German dictionary.
import {
  FAMILIES, ABILITIES, TRAITS, LINKS, ASPECTS, STAGES, WAVE_ARC, HABITS, UPGRADES, SPELLS, VERBS, MOODS, STANCES, STRESSORS,
} from '../game/data.js';
import { MUTATIONS } from '../game/content/mutations.js';
import { STRESSOR_EXTRA, STRESSOR_AFFIXES } from '../game/content/stressors.js';
import { KOANS } from '../game/content/koans.js';
import { CARDS } from '../game/content/cards.js';
import { NAMING, NAMING_EN } from '../game/genome.js';

export const LOCALES = ['en', 'de'];
// The German translation is not complete yet: while this is false the switch is hidden and the game stays English.
export const LOCALE_SWITCH = false;
const KEY = 'non-mind-locale';
let locale = 'en', ui = {}, snap = null;
const listeners = new Set();
export const getLocale = () => locale;
export const onLocale = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
/** Interface string lookup, keyed by the English source text. */
export const t = (s) => (locale === 'en' ? s : ui[s] ?? s);

const FIELDS = ['name', 'text', 'field', 'witness', 'hint', 'basis', 'epithet', 'label', 'principle', 'quote'];
const pick = (o) => Object.fromEntries(FIELDS.filter((k) => k in o).map((k) => [k, o[k]]));
const byId = (list) => (Array.isArray(list) ? list.map((o) => [o.id, o]) : Object.entries(list));

function snapshot() {
  const tables = { families: FAMILIES, abilities: ABILITIES, traits: TRAITS, aspects: ASPECTS, arcs: WAVE_ARC, habits: HABITS, upgrades: UPGRADES, spells: SPELLS, verbs: VERBS, moods: MOODS, stances: STANCES, stressors: [...STRESSORS, ...STRESSOR_EXTRA], affixes: STRESSOR_AFFIXES, mutations: MUTATIONS, cards: CARDS };
  const en = {};
  for (const [k, list] of Object.entries(tables)) en[k] = Object.fromEntries(byId(list).map(([id, o]) => [id, pick(o)]));
  en.links = LINKS.map(pick); en.stages = STAGES.map(pick);
  en.koans = JSON.parse(JSON.stringify(KOANS));
  return { tables, en };
}
function write(dict) {
  const { tables, en } = snap;
  for (const [k, list] of Object.entries(tables)) for (const [id, o] of byId(list)) Object.assign(o, en[k][id], dict?.[k]?.[id] || {});
  LINKS.forEach((o, i) => Object.assign(o, en.links[i], dict?.links?.[i] || {}));
  // stage ids drive logic and stay English; the shown word is `label`
  STAGES.forEach((o, i) => Object.assign(o, en.stages[i], { label: dict?.stages?.[i]?.id || o.id }, dict?.stages?.[i]?.hint ? { hint: dict.stages[i].hint } : {}));
  const src = dict?.koans || en.koans;
  for (const k of Object.keys(en.koans)) {
    if (Array.isArray(KOANS[k])) KOANS[k].splice(0, KOANS[k].length, ...(src[k] || en.koans[k]));
    else for (const s of Object.keys(en.koans[k])) KOANS[k][s].splice(0, KOANS[k][s].length, ...((src[k] && src[k][s]) || en.koans[k][s]));
  }
}

// German strong adjective endings (no article, nominative): -e feminine, -er masculine, -es neuter.
const END = { f: 'e', m: 'er', n: 'es' };

export async function setLocale(next) {
  if (!LOCALES.includes(next)) next = 'en';
  if (!snap) snap = snapshot();
  if (next === 'de') {
    const [d, m, k, u, c] = await Promise.all([
      import('./de/data.js'), import('./de/mutations.js'), import('./de/koans.js'),
      import('./de/ui.js').catch(() => ({ default: {} })), import('./de/cards.js'),
    ]);
    const D = d.default;
    write({ ...D, mutations: m.default, koans: k.default, cards: c.default });
    Object.assign(NAMING, {
      adj: D.adj, idealized: D.poles.idealizedStem, devalued: D.poles.devaluedStem, hollowed: D.poles.hollowedStem,
      inflect: (stem, familyId) => { const w = stem + (END[D.gender[familyId]] || 'e'); return w.charAt(0).toUpperCase() + w.slice(1); },
    });
    ui = { ...(u.default || {}) };
    for (const [en, de] of Object.entries(D.terms || {})) { ui[en] ??= de; ui[en.charAt(0).toUpperCase() + en.slice(1)] ??= de; }
  } else {
    write(null); Object.assign(NAMING, NAMING_EN); ui = {};
  }
  locale = next;
  try { localStorage.setItem(KEY, next); } catch { /* not persisted */ }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach((fn) => fn(next));
  return next;
}

/** The saved choice, else the browser's language. */
export function initialLocale() {
  if (!LOCALE_SWITCH) return 'en';
  try { const s = localStorage.getItem(KEY); if (LOCALES.includes(s)) return s; } catch { /* ignore */ }
  return typeof navigator !== 'undefined' && /^de\b/i.test(navigator.language || '') ? 'de' : 'en';
}

// Self-wiring in the browser: apply the saved or browser language at start. The language ring fires
// `nonmind:locale`: the player is asked first, then the game is saved and the whole page reloads, so
// every element (tables, interface, manual) comes up in one language.
function askSwitch() {
  if (document.getElementById('nm-locale-ask')) return;
  const next = locale === 'en' ? 'de' : 'en';
  const txt = next === 'de'
    ? { h: 'Auf Deutsch wechseln?', p: 'Das Spiel wird gespeichert und neu geladen.', yes: 'Deutsch', no: 'English bleiben' }
    : { h: 'Switch to English?', p: 'The game is saved and reloads.', yes: 'English', no: 'bei Deutsch bleiben' };
  const el = document.createElement('div');
  el.id = 'nm-locale-ask'; el.setAttribute('aria-modal', 'true'); el.setAttribute('role', 'dialog'); el.dataset.modal = 'locale';
  el.className = 'pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center bg-ink/35 backdrop-blur-[3px]';
  el.innerHTML = `<div class="w-[min(440px,92vw)] rounded-[26px] border-4 border-ink bg-paper p-6 text-center shadow-[8px_10px_0_var(--color-ink)]">
    <div class="font-title text-3xl text-ink">${txt.h}</div>
    <p class="mt-2 font-body italic text-ink-2">${txt.p}</p>
    <div class="mt-4 flex justify-center gap-3 font-head">
      <button data-no class="rounded-full border-[3px] border-ink bg-paper px-5 py-1.5">${txt.no}</button>
      <button data-yes class="rounded-full border-[3px] border-ink bg-violet px-5 py-1.5 text-paper shadow-[3px_4px_0_var(--color-ink)]">${txt.yes}</button>
    </div></div>`;
  const close = () => { el.remove(); window.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-no]')) close();
    else if (e.target.closest('[data-yes]')) {
      try { localStorage.setItem(KEY, next); } catch { /* not persisted */ }
      window.dispatchEvent(new Event('nonmind:before-reload'));
      window.location.reload();
    }
  });
  window.addEventListener('keydown', onKey, true);
  document.body.appendChild(el);
}
if (typeof window !== 'undefined') {
  window.addEventListener('nonmind:locale', askSwitch);
  const first = initialLocale();
  if (first !== 'en') setLocale(first);
}
