// Number formatting for the HUD. Short names are lowercase because font-stat has no capitals.
export const TIER_SHORT = ['', 'k', 'm', 'b', 't', 'qa', 'qi', 'sx', 'sp', 'oc', 'no'];
export const TIER_LONG = [
  '', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion',
];

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
  const s = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n < 1000) {
    if (int || n >= 100 || n === 0) return s + Math.floor(n + 1e-9);
    return s + n.toFixed(n >= 10 ? 1 : 2);
  }
  if (n >= 1e33) return s + n.toExponential(2).replace('+', '');
  const { v, e, d } = split(n);
  return s + v.toFixed(d) + TIER_SHORT[e];
}

/** Long form for tooltips: "9.42 million". */
export function fmtLong(n) {
  if (n == null || !Number.isFinite(n)) return fmt(n);
  if (Math.abs(n) < 1000) return fmt(n);
  if (Math.abs(n) >= 1e33) return n.toExponential(3);
  const { v, e, d } = split(Math.abs(n));
  return `${n < 0 ? '-' : ''}${v.toFixed(d)} ${TIER_LONG[e]}`;
}

export const fmtTime = (s) => {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const pct = (v) => `${Math.round(v)}%`;
export const ROMAN = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii'];
