// Optimal recognition point (ORP) for RSVP display.
// @andyed/kinetic-type-engine deliberately does not ship ORP math, so this is the
// standard heuristic: the eye wants to land slightly left of a word's centre.

const EDGE_PUNCT = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/** Index (UTF-16 offset into `word`) of the letter the eye should fixate on. */
export function orpIndex(word) {
  const core = word.replace(EDGE_PUNCT, '');
  if (!core) return Math.max(0, Math.floor((word.length - 1) / 2));
  const lead = word.indexOf(core);
  const n = core.length;
  const i = n <= 1 ? 0 : n <= 5 ? 1 : n <= 9 ? 2 : n <= 13 ? 3 : 4;
  return lead + i;
}

/**
 * ORP for a chunk that may hold several words: fixate on the word that
 * straddles the chunk's midpoint, at that word's own ORP.
 */
export function chunkOrpIndex(chunk) {
  if (!/\s/.test(chunk)) return orpIndex(chunk);
  const mid = chunk.length / 2;
  const re = /\S+/g;
  let best = null;
  let match;
  while ((match = re.exec(chunk))) {
    const start = match.index;
    const end = start + match[0].length;
    const distance = mid < start ? start - mid : mid > end ? mid - end : 0;
    if (!best || distance < best.distance) best = { start, word: match[0], distance };
  }
  return best ? best.start + orpIndex(best.word) : 0;
}

/** Split a chunk into the text before the ORP letter, the letter, and the rest. */
export function splitAtOrp(chunk) {
  const index = chunkOrpIndex(chunk);
  // Keep surrogate pairs / combining marks together.
  const letter = Array.from(chunk.slice(index))[0] ?? '';
  return { pre: chunk.slice(0, index), orp: letter, post: chunk.slice(index + letter.length), index };
}
