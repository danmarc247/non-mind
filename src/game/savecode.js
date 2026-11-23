// Pure save-code codec: no game, no DOM. `NM1.<base64url(envelope json)>.<checksum>`.
// The envelope is { v: SAVE_VERSION, d: <serialize(G) string> }. Never throws; returns { ok, error | json }.
export const SAVE_PREFIX = 'NM1.';
export const SAVE_VERSION = 1;
const MAX_LEN = 8 * 1024 * 1024;

// FNV-1a 32-bit over a string, as 8 hex chars.
export function checksum(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

function toB64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** serialized game string -> save code. */
export function encodeSave(json, version = SAVE_VERSION) {
  const body = toB64Url(JSON.stringify({ v: version, d: json }));
  return `${SAVE_PREFIX}${body}.${checksum(body)}`;
}

/** save code -> { ok: true, json } | { ok: false, error }. Checks prefix, checksum, version and shape. */
export function decodeSave(str) {
  try {
    if (typeof str !== 'string') return { ok: false, error: 'not text' };
    const s = str.replace(/\s+/g, '');
    if (!s) return { ok: false, error: 'empty' };
    if (s.length > MAX_LEN) return { ok: false, error: 'too large' };
    if (!s.startsWith(SAVE_PREFIX)) return { ok: false, error: 'not a NON-MIND save' };
    const rest = s.slice(SAVE_PREFIX.length);
    const dot = rest.lastIndexOf('.');
    if (dot < 1) return { ok: false, error: 'truncated' };
    const body = rest.slice(0, dot), sum = rest.slice(dot + 1);
    if (!/^[A-Za-z0-9_-]+$/.test(body)) return { ok: false, error: 'corrupt' };
    if (checksum(body) !== sum) return { ok: false, error: 'checksum mismatch' };
    const env = JSON.parse(fromB64Url(body));
    if (!env || typeof env !== 'object' || typeof env.d !== 'string') return { ok: false, error: 'bad shape' };
    if (env.v !== SAVE_VERSION) return { ok: false, error: `unknown version ${String(env.v).slice(0, 12)}` };
    const d = JSON.parse(env.d);
    if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, error: 'bad shape' };
    if (!Number.isFinite(d.seed) || !Array.isArray(d.units) || !Number.isFinite(d.stage) || d.rs == null) return { ok: false, error: 'bad shape' };
    return { ok: true, json: env.d };
  } catch {
    return { ok: false, error: 'corrupt' };
  }
}
