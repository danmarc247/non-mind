// Title overlay: shown while the game has not started.
import { useEffect, useState } from 'react';
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

// Plain picture: turns the painted shaders off and keeps the colours, for machines that struggle.
const PLAIN_KEY = 'non-mind-plain';
function usePlain() {
  const [on, setOn] = useState(() => { try { return localStorage.getItem(PLAIN_KEY) === '1'; } catch { return false; } });
  useEffect(() => {
    const h = (e) => setOn(!!e.detail?.plain);
    const g = (e) => { if (typeof e.detail === 'boolean') setOn(e.detail); };
    window.addEventListener('nonmind:plain-changed', h); window.addEventListener('nonmind:plain', g);
    return () => { window.removeEventListener('nonmind:plain-changed', h); window.removeEventListener('nonmind:plain', g); };
  }, []);
  const flip = () => {
    const v = !on;
    try { localStorage.setItem(PLAIN_KEY, v ? '1' : '0'); } catch { /* storage blocked */ }   // the scene may not be loaded yet: it reads this when it is
    window.dispatchEvent(new CustomEvent('nonmind:plain', { detail: v }));
  };
  return [on, flip];
}
function PlainSwitch() {
  const [on, flip] = usePlain();
  return (
    <button type="button" role="switch" aria-checked={on} onClick={flip}
      className="mt-2 inline-flex items-center gap-3 rounded-full border-[3px] border-ink bg-paper px-4 py-2 text-left shadow-[2px_3px_0_0_var(--color-ink)] outline-none transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-yolk">
      <span className={`relative h-6 w-11 shrink-0 rounded-full border-[2.5px] border-ink transition-colors duration-150 ${on ? 'bg-teal' : 'bg-paper-2'}`}>
        <span className={`absolute top-[1px] h-[17px] w-[17px] rounded-full border-2 border-ink bg-paper transition-all duration-150 ${on ? 'left-[21px]' : 'left-[1px]'}`} />
      </span>
      <span className="flex flex-col">
        <span className="font-head text-[16px] leading-none tracking-wide text-ink uppercase">plain picture {on ? 'on' : 'off'}</span>
        <span className="mt-1 font-body text-[13px] leading-tight text-ink-2 italic">The paint is put away; the colours stay. For machines that struggle.</span>
      </span>
    </button>
  );
}

export default function Title() {
  const [saved] = useState(hasSave);
  const [plainOn] = usePlain();
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
        {plainOn
          ? <div className="absolute inset-0" style={{ background: `radial-gradient(60% 55% at 22% 28%, ${toneHex('magenta')} 0%, transparent 70%), radial-gradient(55% 60% at 78% 70%, ${toneHex('ultra')} 0%, transparent 72%), ${toneHex('paper')}` }} />
          : <Balatro color1={toneHex('magenta')} color2={toneHex('ultra')} color3={toneHex('paper')} contrast={2.2} lighting={0.25} swirl={0.3} speed={0.55} pixelSize={2.5} mouseInteraction intro />}
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
        <PlainSwitch />
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, delay: 1.2 }}
          className="mt-6 font-body text-[15px] italic text-ink-2">
          Dedicated to Dillon and Dillon&rsquo;s wonderful Mind
        </motion.p>
      </div>
    </motion.div>
  );
}
