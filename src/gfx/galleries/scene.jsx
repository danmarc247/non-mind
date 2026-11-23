import { createRoot } from 'react-dom/client';
import '../../index.css';
import Scene from '../Scene.jsx';
import { game, act, tick } from '../../game/store.js';
import { createGame, defaultBot, step } from '../../game/index.js';

game.G = createGame(5); game.started = true;
// fast-forward with the bot so the arena has something to show
window.__ff = (sec) => { const G = game.G; for (let t = 0; t < sec; t += 0.1) { defaultBot(G, t); step(G, 0.1); G.events.length = 0; } };
window.__bot = true;
setInterval(() => { if (window.__bot) defaultBot(game.G, performance.now() / 1000); }, 200);
window.__act = act; window.__tick = tick;
const q = new URLSearchParams(location.search);
if (q.get('ff')) window.__ff(+q.get('ff'));
createRoot(document.getElementById('root')).render(<div className="fixed inset-0"><Scene quality={q.get('q') || undefined} post={q.get('post') !== '0'} /></div>);
