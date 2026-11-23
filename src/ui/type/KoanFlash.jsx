import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  processText,
  smartChunkWithNLP,
  calculateFrameDuration,
  getAnimationPhases,
  computeTrailTransform,
  getSafeZoom,
} from '@andyed/kinetic-type-engine';
import { cn } from '../../lib/cn.js';
import { splitAtOrp } from './orp.js';
import { TONES, toneCss } from './tones.js';

// Trail recipes. The engine's units are abstract; here one unit = 1em of the display size.
const TRAILS = {
  none: { mode: 'none', count: 0 },
  blur: {
    mode: 'blur',
    count: 4,
    baseOpacity: 0.42,
    opacityDecay: 0.64,
    scaleDecay: 1.015,
    zStep: 0,
    direction: { x: -1, y: 0 },
    spacing: 0.085,
  },
  echo: {
    mode: 'echo',
    count: 3,
    baseOpacity: 0.34,
    opacityDecay: 0.62,
    scaleDecay: 0.93,
    zStep: 0,
    direction: { x: 0.35, y: 1 },
    distancePerTrail: 0.17,
    timeDelayPerTrail: 0.045,
  },
  rgb_split: {
    mode: 'rgb_split',
    count: 3,
    baseOpacity: 0.85,
    opacityDecay: 1,
    scaleDecay: 1,
    zStep: 0,
    colors: [TONES.magenta, TONES.yolk, TONES.teal],
    splitDistance: 0.055,
    blending: 'additive',
  },
};

const ENTER_MS = 70; // pop-in; well inside the engine's 120 ms recognition window
const LOOP_GAP_MS = 650;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => {
  if (b <= a) return v >= b ? 1 : 0;
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

function buildTimeline(text, wpm, density, nlp) {
  const source = typeof text === 'string' ? text : '';
  if (!source.trim()) return { frames: [], total: 0 };
  let chunks;
  try {
    chunks = nlp ? smartChunkWithNLP(source, Math.max(1, Math.round(density) || 3)) : processText(source, density);
  } catch {
    chunks = source
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => ({ text: word }));
  }
  let at = 0;
  const frames = [];
  for (const chunk of chunks) {
    const label = (chunk.text ?? '').replace(/\s+/g, ' ').trim();
    if (!label) continue;
    const durationMs = calculateFrameDuration(chunk, Math.max(60, wpm));
    const overrides = chunk.visualOverrides ?? {};
    const loud = Boolean(overrides.isLoud);
    const wanted = overrides.zoom ?? (loud ? 1.35 : 1);
    frames.push({
      ...splitAtOrp(label),
      text: label,
      startMs: at,
      durationMs,
      phases: getAnimationPhases(durationMs),
      loud,
      zoom: Math.min(wanted, getSafeZoom(label, overrides)),
    });
    at += durationMs;
  }
  return { frames, total: at };
}

function Word({ frame, accent, innerRef, preRef, postRef, hidden, style }) {
  return (
    <span
      ref={innerRef}
      aria-hidden="true"
      className="absolute left-0 top-0 whitespace-pre will-change-transform"
      style={{ transform: 'translate(-50%, -50%)', ...style }}
    >
      <span ref={preRef} className="absolute right-full top-0">
        {frame?.pre}
      </span>
      <span style={hidden ? undefined : { color: accent }}>{frame?.orp}</span>
      <span ref={postRef} className="absolute left-full top-0">
        {frame?.post}
      </span>
    </span>
  );
}

/**
 * Kinetic RSVP ambient line: one chunk at a time, pinned on its optimal recognition letter.
 *
 * @param {object} props
 * @param {string} props.text
 * @param {number} [props.wpm=300]
 * @param {number} [props.density=1] words per flash (or max words per phrase with `nlp`)
 * @param {'blur'|'echo'|'rgb_split'|'none'} [props.trail='blur']
 * @param {string} [props.tone] palette tone name (or any CSS color) for the ORP letter
 * @param {boolean} [props.loop=false]
 * @param {() => void} [props.onDone] fired once when a non-looping run ends
 * @param {boolean} [props.nlp=false] chunk on grammatical phrase boundaries (smartChunkWithNLP)
 * @param {string} [props.className]
 */
export function KoanFlash({
  text,
  wpm = 300,
  density = 1,
  trail = 'blur',
  tone,
  loop = false,
  onDone,
  nlp = false,
  className,
  ...rest
}) {
  const { frames, total } = useMemo(() => buildTimeline(text, wpm, density, nlp), [text, wpm, density, nlp]);
  const [index, setIndex] = useState(-1);
  const [calm] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const config = calm ? TRAILS.none : (TRAILS[trail] ?? TRAILS.blur);

  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const mainRef = useRef(null);
  const preRef = useRef(null);
  const postRef = useRef(null);
  const trailRefs = useRef([]);
  const fitRef = useRef(1);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const frame = index >= 0 ? frames[index] : null;
  const accent = toneCss(tone);

  // Shrink a chunk that would run off either side of the box (it is centred on its ORP letter).
  useLayoutEffect(() => {
    const root = rootRef.current;
    const main = mainRef.current;
    if (!frame || !root || !main) {
      fitRef.current = 1;
      return;
    }
    const half = root.clientWidth / 2 - 8;
    const letter = main.offsetWidth / 2;
    const reach = Math.max(
      (preRef.current?.offsetWidth ?? 0) + letter,
      (postRef.current?.offsetWidth ?? 0) + letter,
      1,
    );
    fitRef.current = half > 0 ? Math.min(1, half / (reach * frame.zoom)) : 1;
  }, [frame]);

  useEffect(() => {
    if (!frames.length) {
      setIndex(-1);
      return undefined;
    }
    let raf = 0;
    let stopped = false;
    let start = performance.now();
    let current = -1;

    // Commit the swap synchronously so the new chunk is in the DOM (and measured by the
    // layout effect above) before this frame's styles are written: no one-frame ghost of
    // the previous chunk wearing the next chunk's transform.
    const show = (next) => {
      if (next === current) return;
      current = next;
      flushSync(() => setIndex(next));
    };

    const paint = (active, elapsed) => {
      const stage = stageRef.current;
      const main = mainRef.current;
      if (!stage || !main) return;
      const local = elapsed - active.startMs;
      const progress = clamp01(local / active.durationMs);
      const enter = calm ? 1 : clamp01(local / ENTER_MS);
      const pop = calm ? 1 : 0.84 + 0.16 * easeOutBack(enter);
      stage.style.transform = `scale(${(active.zoom * fitRef.current * pop).toFixed(4)})`;
      main.style.opacity = String(0.55 + 0.45 * enter); // never fully hidden, even at low frame rates

      const { expressionStart, expressionFull } = active.phases;
      for (let i = 0; i < config.count; i += 1) {
        const node = trailRefs.current[i];
        if (!node) continue;
        const t = computeTrailTransform(config, i, progress, elapsed / 1000);
        // Trails stay out of the way until the word has been recognised, then bloom.
        const lag = (t.timeOffset * 1000) / active.durationMs;
        let amount = smooth(expressionStart + lag, Math.min(1, expressionFull + lag + 0.08), progress);
        if (config.mode === 'rgb_split') amount *= 0.65 + 0.35 * Math.sin(elapsed * 0.045 + i * 2.1);
        const x = t.positionOffset.x * amount;
        const y = -t.positionOffset.y * amount; // engine is y-up, CSS is y-down
        const scale = 1 + (t.scale - 1) * amount;
        node.style.transform =
          `translate(-50%, -50%) translate(${x.toFixed(4)}em, ${y.toFixed(4)}em) ` +
          `rotate(${t.rotation.toFixed(4)}rad) scale(${scale.toFixed(4)})`;
        node.style.opacity = String(clamp01(t.opacity * amount));
        node.style.filter = config.mode === 'blur' ? `blur(${(0.028 * (i + 1) * amount).toFixed(4)}em)` : 'none';
        node.style.color = t.colorOverride ?? '';
        // "Additive" washes out on paper-white; multiply is the paint-on-paper equivalent.
        node.style.mixBlendMode = t.blending === 'additive' ? 'multiply' : '';
      }
    };

    const tick = (now) => {
      if (stopped) return;
      let elapsed = now - start;
      if (elapsed >= total) {
        if (!loop) {
          show(-1);
          onDoneRef.current?.();
          return;
        }
        if (elapsed < total + LOOP_GAP_MS) {
          show(-1);
          raf = requestAnimationFrame(tick);
          return;
        }
        start = now;
        elapsed = 0;
        current = -1;
      }
      let next = current < 0 ? 0 : current;
      while (next < frames.length - 1 && elapsed >= frames[next].startMs + frames[next].durationMs) next += 1;
      show(next);
      paint(frames[next], elapsed);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [frames, total, loop, config, calm]);

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={typeof text === 'string' ? text : undefined}
      className={cn(
        'relative min-h-[1.7em] w-full overflow-hidden font-title text-6xl leading-none text-ink',
        className,
      )}
      {...rest}
    >
      <div ref={stageRef} className="absolute left-1/2 top-1/2 will-change-transform">
        {frame &&
          Array.from({ length: config.count }, (_, i) => (
            <Word
              key={`trail-${config.count - 1 - i}`}
              frame={frame}
              hidden
              innerRef={(node) => {
                trailRefs.current[config.count - 1 - i] = node;
              }}
              style={{ opacity: 0, pointerEvents: 'none' }}
            />
          ))}
        {frame && <Word frame={frame} accent={accent} innerRef={mainRef} preRef={preRef} postRef={postRef} />}
      </div>
    </div>
  );
}

export default KoanFlash;
