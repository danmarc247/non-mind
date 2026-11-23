// Private gallery for Lineage (Pixi) and Ceremony (GSAP). Not shipped; mounted by lineage-gallery.html.
// Drives the real engine with the bot; events flow through the store's tick so both components hear them.
// ?ff=900 fast-forwards; ?open=1 opens the map; ?scene=1 mounts the real 3D scene behind.
import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import '../../index.css';
import Lineage from '../Lineage.jsx';
import Ceremony from '../Ceremony.jsx';
import { game, tick, act, select } from '../../game/store.js';
import { createGame, defaultBot } from '../../game/index.js';
import { mood } from '../../gfx/mood.js';

const Scene = lazy(() => import('../../gfx/Scene.jsx'));
const q = new URLSearchParams(location.search);
game.G = createGame(+(q.get('seed') || 5)); game.started = true;
let botT = 0;
window.__ff = (sec) => { for (let t = 0; t < sec; t += 0.1) { botT += 0.1; defaultBot(game.G, botT); tick(0.1); } mood.stage = game.G.stage; mood.overwhelm = game.G.overwhelm; };
if (q.get('ff')) window.__ff(+q.get('ff'));
window.__game = game; window.__act = act; window.__select = select; window.__mood = mood;
window.__bot = q.get('bot') !== '0';
let last = performance.now();
const loop = (now) => {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (window.__bot) { botT += dt; defaultBot(game.G, botT); tick(dt); }
  mood.stage += (game.G.stage - mood.stage) * (1 - Math.exp(-0.8 * dt));
  mood.overwhelm = game.G.overwhelm;
  window.__frames = window.__lineageFrames || 0;
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
window.__open = () => window.dispatchEvent(new Event('nonmind:lineage'));

const btn = 'rounded-full border-[3px] border-ink bg-paper px-3 py-0.5 font-head text-sm text-ink shadow-[2px_3px_0_var(--color-ink)] hover:-translate-y-0.5';
function Gallery() {
  return (
    <div className="fixed inset-0 bg-paper" style={{
      backgroundImage: [
        'radial-gradient(circle at 22% 30%, color-mix(in srgb, var(--color-yolk) 70%, transparent) 0 9%, transparent 22%)',
        'radial-gradient(circle at 76% 62%, color-mix(in srgb, var(--color-teal) 55%, transparent) 0 12%, transparent 26%)',
        'radial-gradient(circle at 60% 18%, color-mix(in srgb, var(--color-magenta) 45%, transparent) 0 6%, transparent 18%)',
        'radial-gradient(circle at 30% 80%, color-mix(in srgb, var(--color-violet) 40%, transparent) 0 8%, transparent 20%)',
      ].join(','),
    }}>
      {q.get('scene') === '1' && <Suspense fallback={null}><div className="fixed inset-0"><Scene quality="low" post={false} /></div></Suspense>}
      <div className="fixed left-3 top-3 z-40 flex flex-wrap gap-2">
        <button className={btn} onClick={window.__open}>lineage · L</button>
        {['stage', 'ladder', 'ending', 'wave', 'reset'].map((k) => <button key={k} className={btn} onClick={() => window.__ceremony?.(k)}>{k}</button>)}
      </div>
      <Lineage />
      <Ceremony />
    </div>
  );
}
createRoot(document.getElementById('root')).render(<Gallery />);
if (q.get('open') === '1') setTimeout(window.__open, 300);
