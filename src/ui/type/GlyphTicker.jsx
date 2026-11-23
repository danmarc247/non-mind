import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn.js';
import { toneCss, toneHex } from './tones.js';

const MOUNT_TIMEOUT_MS = 12000;

let reported = false;
function reportFallback(reason) {
  if (reported) return;
  reported = true;
  console.info(`[GlyphTicker] using the DOM fallback: ${reason}`);
}

function reasonOf(error) {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

// public/ files must be addressed relative to the deployed base (GitHub Pages sub-path).
function bakedFontUrl() {
  return new URL(`${import.meta.env.BASE_URL}fonts/hyper.font.glb`, document.baseURI).href;
}

/**
 * One line of Hypermonosaturation with per-glyph motion, drawn by @pmndrs/glyph in its own
 * small WebGL2 canvas. Purely decorative tech: on any failure (no WebGL2, wasm/font fetch,
 * context loss, timeout) it silently becomes a plain DOM span in font-stat.
 *
 * @param {object} props
 * @param {string} props.text lowercased for display (the face has no capitals)
 * @param {string} [props.tone='ink'] palette tone name or CSS color
 * @param {string} [props.className] size it here (default h-10 w-full)
 */
export function GlyphTicker({ text, tone = 'ink', className, style, ...rest }) {
  const boxRef = useRef(null);
  const tickerRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | live | fallback

  const label = typeof text === 'string' ? text.toLowerCase() : '';
  const color = toneHex(tone, toneHex('ink'));
  const latest = useRef({ text: label, color });
  latest.current = { text: label, color };

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    let alive = true;
    let observer;
    let timer = 0;
    let mounting = null;

    // A fresh canvas per attempt: one that failed or lost its context cannot be reused
    // (this also keeps StrictMode's mount/unmount/mount from sharing a GL context).
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .3s;pointer-events:none';
    box.prepend(canvas);

    const fallback = (error) => {
      reportFallback(reasonOf(error));
      tickerRef.current = null;
      // If the runtime shows up late (after a timeout) make sure it is torn down.
      mounting?.then((ticker) => ticker?.dispose()).catch(() => {});
      canvas.remove();
      if (alive) setStatus('fallback');
    };

    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`not ready after ${MOUNT_TIMEOUT_MS} ms`)), MOUNT_TIMEOUT_MS);
    });

    mounting = (async () => {
      const { mountGlyphTicker } = await import('./glyphTickerRuntime.js');
      if (!alive) return null;
      return mountGlyphTicker(canvas, { ...latest.current, fontUrl: bakedFontUrl(), onError: fallback });
    })();

    Promise.race([mounting, timeout])
      .then((ticker) => {
        if (!ticker || !alive) return;
        tickerRef.current = ticker;
        ticker.update(latest.current);
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(() => ticker.resize(box.clientWidth, box.clientHeight));
          observer.observe(box);
        }
        canvas.style.opacity = '1';
        setStatus('live');
      }, fallback)
      .finally(() => clearTimeout(timer));

    return () => {
      alive = false;
      clearTimeout(timer);
      observer?.disconnect();
      tickerRef.current = null;
      // Covers a finished mount as well as one that resolves after a timeout or unmount.
      mounting
        .then((ticker) => ticker?.dispose())
        .catch(() => {})
        .finally(() => canvas.remove());
    };
  }, []);

  useEffect(() => {
    tickerRef.current?.update({ text: label, color });
  }, [label, color]);

  return (
    <div
      ref={boxRef}
      className={cn('relative h-10 w-full overflow-hidden [container-type:size]', className)}
      style={style}
      {...rest}
    >
      {/* Always in the DOM for assistive tech; visible until (or instead of) the canvas. */}
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center whitespace-nowrap font-stat leading-none',
          'transition-opacity duration-300',
          status === 'live' && 'opacity-0',
        )}
        style={{ color: toneCss(tone, 'ink'), fontSize: '62cqh' }}
      >
        {label}
      </span>
    </div>
  );
}

export default GlyphTicker;
