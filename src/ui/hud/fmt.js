// Number formatting for the HUD. Short names are lowercase because font-stat has no capitals.
export const TIER_SHORT = ['', 'k', 'm', 'b', 't', 'qa', 'qi', 'sx', 'sp', 'oc', 'no'];
export const TIER_LONG = [
  '', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion',
];

// three significant figures, decided AFTER rounding (9.996 is '10.0', not '10.00')
const sig3 = (v) => { const r = Number(v.toPrecision(3)); return r >= 100 ? String(Math.round(r)) : r >= 10 ? r.toFixed(1) : r.toFixed(2); };

function split(n) {
  let e = Math.min(TIER_SHORT.length - 1, Math.floor(Math.log10(n) / 3));
  let v = n / Math.pow(1000, e);
  let d = v < 10 ? 2 : v < 100 ? 1 : 0;
  // 999.96k rounds to "1000k": carry into the next tier
  if (Number(v.toFixed(d)) >= 1000 && e < TIER_SHORT.length - 1) { e++; v = n / Math.pow(1000, e); d = 2; }
  return { v, e, d };
}

/** Compact number: 9.42, 94.2, 942, 9.42k ... 1.00no (1e30), then exponent. `int` drops decimals below 1000. */
export function fmt(n, { int = false } = {}) {
  if (n == null || Number.isNaN(n)) return '-';
  if (!Number.isFinite(n)) return n > 0 ? 'inf' : '-inf';
  if (Math.abs(n) < 0.005) n = 0; // never '-0.00'
  const s = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 999.5 && n < 1000 && !int) n = 1000; // 999.6 rounds into the next tier, not to '1000'
  if (n < 1000) {
    if (int || n >= 100 || n === 0) return s + Math.round(n >= 100 && !int ? n : Math.floor(n + 1e-9));
    return s + sig3(n);
  }
  if (n >= 9.995e32) return s + n.toExponential(2).replace('+', ''); // past the last named tier (no '1000no')
  const { v, e, d } = split(n);
  return s + sig3(v) + TIER_SHORT[e];
}

/** Long form for tooltips: "9.42 million". */
export function fmtLong(n) {
  if (n == null || !Number.isFinite(n)) return fmt(n);
  if (Math.abs(n) < 1000) return fmt(n);
  if (Math.abs(n) >= 1e33) return n.toExponential(3);
  const { v, e, d } = split(Math.abs(n));
  return `${n < 0 ? '-' : ''}${sig3(v)} ${TIER_LONG[e]}`;
}

export const fmtTime = (s) => {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const pct = (v) => `${Math.round(v)}%`;
export const ROMAN = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii'];
