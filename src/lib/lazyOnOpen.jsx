// Load a self-toggling modal (Manual, SaveMenu, Lineage) on first open instead of at boot.
// A tiny eager stub listens for the modal's window event (and its hotkey) once, imports the module,
// mounts it, then re-dispatches the event so the freshly mounted component opens itself.
import { Suspense, lazy, useEffect, useState } from 'react';

function Replay({ event }) {
  useEffect(() => { window.dispatchEvent(new Event(event)); }, [event]);   // runs after the module's own listeners are attached
  return null;
}

// keyOk(e) mirrors the real component's hotkey guard; omit it for event-only modals.
export function lazyOnOpen(load, event, keyOk) {
  const Mod = lazy(() => load().catch(() => ({ default: () => null })));   // a failed chunk never breaks the game
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
    return <Suspense fallback={null}><Mod {...props} /><Replay event={event} /></Suspense>;
  };
}
