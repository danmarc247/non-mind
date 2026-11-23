// HUD gallery: <Hud /> over a static painted stand-in for the arena, driving the real game.
// ?title=1 shows the title overlay; otherwise the game starts at once.
// window.__ff(seconds) fast-forwards with the engine's default bot.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import Hud from '../Hud.jsx';
import { defaultBot } from '../../game/index.js';
import { act, choose, game, select, setPending, tick, wipe } from '../../game/store.js';

const q = new URLSearchParams(location.search);
wipe();
if (!q.has('title')) game.started = true;

// a few scripted moves so the early HUD has something to show
function script() {
  const G = game.G;
  for (let i = 0; i < 6; i++) act('attend');
  for (let i = 0; i < 3; i++) act('buy', i);
  G.units.filter((u) => !u.seat).forEach((u, i) => act('place', u.id, { ring: 0, dir: i * 2 }));
}
if (game.started) script();

let last = performance.now();
let simT = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!q.has('still')) tick(dt || 1 / 30);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.__ff = (seconds, dt = 0.1) => {
  for (let t = 0; t < seconds; t += dt) {
    simT += dt;
    defaultBot(game.G, simT);
    tick(dt);
  }
  return { stage: game.G.stage, wave: game.G.wave, cycle: game.G.cycle, units: game.G.units.length, overwhelm: game.G.overwhelm };
};
Object.assign(window, { __act: act, __choose: choose, __select: select, __setPending: setPending, __tick: tick });

function Arena() {
  // painted stand-in for the WebGL canvas
  return (
    <div className="fixed inset-0 overflow-hidden bg-paper">
      <div className="absolute -left-[10%] -top-[20%] h-[70%] w-[60%] rounded-full bg-yolk opacity-70 blur-[2px]" />
      <div className="absolute -right-[12%] top-[10%] h-[60%] w-[45%] rounded-full bg-teal opacity-60" />
      <div className="absolute bottom-[-25%] left-[20%] h-[60%] w-[50%] rounded-full bg-magenta opacity-55" />
      <div className="absolute bottom-[5%] right-[5%] h-[30%] w-[25%] rounded-full bg-violet opacity-50" />
      <div className="absolute left-1/2 top-1/2 h-[46vh] w-[46vh] -translate-x-1/2 -translate-y-1/2 rounded-full border-[6px] border-ink bg-paper/60">
        <div className="absolute inset-[18%] rounded-full border-[4px] border-ink/60" />
        <div className="absolute inset-[40%] rounded-full border-[4px] border-ink bg-ultra" />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Arena />
    <Hud />
  </StrictMode>,
);
