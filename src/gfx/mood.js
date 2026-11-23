// Shared, mutable render-mood. The game loop writes it once per frame; every
// shader reads it. Plain object on purpose: no React re-renders at 60 Hz.
export const mood = {
  time: 0,          // seconds
  complexity: 0,    // 0..1  how much structure has accumulated this run
  overwhelm: 0,     // 0..1  how far complexity exceeds capacity
  tension: 0,       // 0..1  battle intensity right now
  depth: 0,         // prestige depth (integer), shifts palettes
  stage: 0,         // 0..17 index into the 18-stage loop
  flash: 0,         // 0..1  decays; set to 1 on big events (reset, wave clear)
  audio: { low: 0, mid: 0, high: 0, rms: 0 },
};

// Acrylic palette from the reference paintings (linear-ish sRGB triples 0..1).
export const PALETTE = {
  paper: [0.984, 0.965, 0.925], ink: [0.106, 0.063, 0.188],
  magenta: [1.0, 0.176, 0.478], ultra: [0.165, 0.169, 1.0], yolk: [1.0, 0.824, 0.122],
  tangerine: [1.0, 0.478, 0.102], teal: [0.09, 0.71, 0.651], violet: [0.541, 0.247, 0.988],
  blood: [0.89, 0.149, 0.184], leaf: [0.184, 0.749, 0.29], rose: [1.0, 0.62, 0.812], sky: [0.561, 0.827, 1.0],
};
