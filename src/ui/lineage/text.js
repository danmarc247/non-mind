// Player-visible lines for the Lineage map (kept in one place for voice review).
// Each line is true to what happened: the ghost's cause comes from the engine event that removed it.
export const LINEAGE_TEXT = {
  title: 'Lineage',
  sub: 'Everything grown this run, and where it went.',
  empty: 'Nothing has been grown yet. The map waits at its centre.',
  hint: 'drag · wheel · pinch · click to select',
  legend: { blend: 'blend', carve: 'carve', mix: 'mix', ghost: 'gone' },
  // live units: how they came to be
  born: {
    integrate: 'It was two.',
    subtract: 'Something is missing from it, usefully.',
    split: 'What was joined remembers its seam.',
  },
  // ghosts: why they are no longer on the board
  gone: {
    link: 'It met its likeness and became one rung of it.',
    integrate: 'It went in whole and is now a part.',
    subtract: 'Some of it remains, as the shape of a cut.',
    split: 'It came apart along its seam.',
    repurpose: 'It is a habit now, not a form.',
    ending: 'An ending is known. It stays known.',
  },
};
