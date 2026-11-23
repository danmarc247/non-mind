// Lazy door to the audio engine, so the title paints without waiting for it.
// The engine module starts loading as soon as this file is imported. Until it lands, getAudio()
// returns a forwarding stand-in: unlock() and setMuted() are replayed once the engine is ready
// (the first click gives sticky user activation, so a late resume() still works), and every other
// call is a quiet no-op. Once loaded, getAudio() returns the real engine, and a stand-in that was
// cached earlier (App's audioRef) forwards each call to it.
let mod = null;
export const audioReady = import('../audio/engine.js').then((m) => (mod = m)).catch(() => null);

const later = (k) => (...args) => audioReady.then((m) => (m ? m.getAudio()[k](...args) : undefined));
const standIn = new Proxy({}, {
  get(_, k) {
    if (mod) { const eng = mod.getAudio(); const v = eng[k]; return typeof v === 'function' ? v.bind(eng) : v; }
    if (k === 'unlock' || k === 'setMuted') return later(k);
    if (k === 'then' || k === 'ctx') return undefined;
    return () => undefined;
  },
});

export function getAudio(opts) {
  return mod ? mod.getAudio(opts) : standIn;
}
