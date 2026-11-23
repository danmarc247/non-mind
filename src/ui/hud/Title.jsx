// Title overlay: shown while the game has not started.
import { useState } from 'react';
import { motion } from 'motion/react';
import Balatro from '../bits/backgrounds/Balatro.jsx';
import { Cryptic, InkButton, toneHex } from '../bits';
import { GRAIN_URL } from '../bits/NoiseBackground';
import { SAVE_KEY } from '../../game/index.js';
import { start, wipe, game } from '../../game/store.js';
import { getAudio } from '../../lib/audio.js';
import { POP } from './shared.jsx';

function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY) && game.G && (game.G.t > 1 || game.G.depth > 0); } catch { return false; }
}

function unlockAudio() {
  try { const a = getAudio(); a?.unlock?.()?.catch?.(() => {}); } catch { /* audio lane may be incomplete */ }
}

export default function Title() {
  const [saved] = useState(hasSave);
  const begin = (fresh) => {
    unlockAudio();
    if (fresh) wipe();
    start();
  };
  return (
    <motion.div
      className="pointer-events-auto fixed inset-0 z-50 overflow-hidden bg-paper"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } }}
    >
      <div className="absolute inset-0 opacity-[0.55]">
        <Balatro color1={toneHex('magenta')} color2={toneHex('ultra')} color3={toneHex('paper')} contrast={2.2} lighting={0.25} swirl={0.3} speed={0.55} pixelSize={2.5} mouseInteraction intro />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-paper)_8%,transparent_70%)] opacity-80" />
      <div className="absolute inset-0 opacity-25 mix-blend-multiply" style={{ backgroundImage: `url("${GRAIN_URL}")` }} />

      <div className="relative flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
        <motion.h1
          className="font-title text-[clamp(64px,11vw,168px)] leading-[0.9] text-ink [text-shadow:5px_6px_0_var(--color-magenta),10px_12px_0_var(--color-ultra)]"
          initial={{ opacity: 0, y: 24, scale: 0.92, rotate: -2 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: -1.5 }}
          transition={{ ...POP, delay: 0.05 }}
        >
          NON-MIND
        </motion.h1>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: 0.25 }} className="max-w-[560px] text-xl">
          <Cryptic text="Nothing is wrong here. Something is happening anyway, softly." tone="ultra" />
        </motion.div>
        <motion.div
          className="mt-4 flex items-center gap-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...POP, delay: 0.35 }}
        >
          {saved ? (
            <>
              <InkButton tone="magenta" size="lg" onClick={() => begin(false)} autoFocus>Continue</InkButton>
              <InkButton tone="paper" size="md" onClick={() => begin(true)}>Begin again</InkButton>
            </>
          ) : (
            <InkButton tone="magenta" size="lg" onClick={() => begin(false)} autoFocus>Begin</InkButton>
          )}
        </motion.div>
        {saved && (
          <p className="font-body text-sm text-ink-2 italic">Begin again forgets everything, even what was kept.</p>
        )}
      </div>
    </motion.div>
  );
}
