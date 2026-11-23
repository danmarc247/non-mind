// Private gallery for SaveMenu. Not shipped; mounted by save-gallery.html.
import { createRoot } from 'react-dom/client';
import '../../index.css';
import SaveMenu from '../SaveMenu.jsx';
import { game, start } from '../../game/store.js';

start();
window.__game = game;
createRoot(document.getElementById('root')).render(
  <div className="min-h-screen bg-paper"><SaveMenu /></div>,
);
