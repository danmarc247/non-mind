// Load a self-toggling modal (Manual, SaveMenu, Lineage) on first open instead of at boot.
// A tiny eager stub listens for the modal's window event (and its hotkey) once, imports the module,
// mounts it, then re-dispatches the event so the freshly mounted component opens itself.
import { Suspense, lazy, useEffect, useState } from 'react';

function Replay({ event }) {
  useEffect(() => { window.dispatchEvent(new Event(event)); }, [event]);   // runs after the module's own listeners are attached
  return null;
}

const RELOAD_KEY = 'non-mind-reloaded-at';
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.dispatchEvent(new Event('nonmind:before-reload'));   // the store saves the game on this
    window.location.reload();
    return true;
  } catch { return false; }
}

// keyOk(e) mirrors the real component's hotkey guard; omit it for event-only modals.
export function lazyOnOpen(load, event, keyOk) {
  // A chunk that fails to load almost always means a newer version was deployed while this page stayed
  // open (the old file names are gone). Save, then reload once to pick the new version up; if it fails
  // again within a minute the stub stays empty, so a failed chunk never breaks the game or loops.
  const Mod = lazy(() => load().catch(() => { reloadForNewVersion(); return { default: () => null }; }));
  return function LazyModal(props) {
    const [on, setOn] = useState(false);
    useEffect(() => {
      if (on) return undefined;
      const go = () => setOn(true);
      const key = (e) => { if (keyOk && keyOk(e)) go(); };
      window.addEventListener(event, go); window.addEventListener('keydown', key);
      return () => { window.removeEventListener(event, go); window.removeEventListener('keydown', key); };
    }, [on]);
    if (!on) return null;
    // the module mounts already open: no replayed event, so a toggle can never cancel itself
    return <Suspense fallback={null}><Mod {...props} initialOpen /></Suspense>;
  };
}
