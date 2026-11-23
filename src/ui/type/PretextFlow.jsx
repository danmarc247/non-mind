import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { clearCache, layoutNextLine, prepareWithSegments } from '@chenglou/pretext';
import { cn } from '../../lib/cn.js';

const MAX_ROWS = 4000;
const MIN_ROW_WIDTH_EM = 2.5; // rows narrower than this are skipped instead of spelling w/o/r/d/s

function fontSizePx(font) {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  return match ? Number(match[1]) : 16;
}

// ---- built-in shapes ------------------------------------------------------
// A shape is (y, lineHeight) => ({ left, width, align? }) for the row [y, y + lineHeight).

function circleShape(side, { width, height, lineHeight }) {
  const gap = lineHeight * 0.6;
  const radius = Math.min(width * 0.36, (height ?? width * 0.8) * 0.46);
  const cy = radius + lineHeight * 0.5;
  return (y, lh) => {
    // Use the point of the row closest to the circle's equator: the widest bite.
    const near = Math.max(y, Math.min(cy, y + lh));
    const dy = near - cy;
    const bite = Math.abs(dy) < radius + gap ? Math.sqrt((radius + gap) ** 2 - dy * dy) : 0;
    return side === 'right' ? { left: 0, width: width - bite } : { left: bite, width: width - bite };
  };
}

function hourglassShape({ width, height }) {
  const waist = 0.42;
  return (y, lh) => {
    const t = height > 0 ? Math.min(1, Math.max(0, (y + lh / 2) / height)) : 0;
    const open = waist + (1 - waist) * Math.abs(2 * t - 1) ** 1.35;
    const w = width * open;
    return { left: (width - w) / 2, width: w, align: 'center' };
  };
}

const none = (width) => () => ({ left: 0, width });

function runLayout(prepared, shapeFn, lineHeight, minWidth) {
  const lines = [];
  let cursor;
  let y = 0;
  for (let row = 0; row < MAX_ROWS; row += 1) {
    const slot = shapeFn(y, lineHeight) ?? {};
    const available = Number.isFinite(slot.width) ? slot.width : 0;
    if (available < minWidth) {
      y += lineHeight;
      continue;
    }
    const line = layoutNextLine(prepared, available, cursor);
    if (line === null) break;
    const left = Number.isFinite(slot.left) ? slot.left : 0;
    const slack = Math.max(0, available - line.width);
    const x = slot.align === 'center' ? left + slack / 2 : slot.align === 'right' ? left + slack : left;
    lines.push({ text: line.text, x, y, width: line.width });
    cursor = line.end;
    y += lineHeight;
  }
  const last = lines[lines.length - 1];
  return { lines, height: last ? last.y + lineHeight : 0 };
}

function layoutFlow(prepared, { width, height, lineHeight, shape, minWidth }) {
  if (typeof shape === 'function') return runLayout(prepared, shape, lineHeight, minWidth);
  if (shape === 'circle-right' || shape === 'circle-left') {
    const side = shape === 'circle-right' ? 'right' : 'left';
    return runLayout(prepared, circleShape(side, { width, height, lineHeight }), lineHeight, minWidth);
  }
  if (shape === 'hourglass') {
    if (height) return runLayout(prepared, hourglassShape({ width, height }), lineHeight, minWidth);
    // No fixed height: the hourglass spans the text itself, so iterate to a fixed point.
    let guess = runLayout(prepared, none(width), lineHeight, minWidth).height * 1.5;
    let result = { lines: [], height: 0 };
    for (let pass = 0; pass < 5; pass += 1) {
      result = runLayout(prepared, hourglassShape({ width, height: guess }), lineHeight, minWidth);
      if (Math.abs(result.height - guess) < lineHeight * 0.5) break;
      guess = (guess + result.height) / 2;
    }
    return result;
  }
  return runLayout(prepared, none(width), lineHeight, minWidth);
}

function fontLoaded(font, text) {
  try {
    return typeof document === 'undefined' || !document.fonts?.check || document.fonts.check(font, text || 'a');
  } catch {
    return true; // unparsable font string: let prepare() report it
  }
}

// Returns a counter that bumps whenever the face (re)becomes available; 0 = not yet.
function useFontReady(font, text) {
  const [ready, setReady] = useState(() => (fontLoaded(font, text) ? 1 : 0));
  useEffect(() => {
    if (fontLoaded(font, text)) {
      setReady((n) => n || 1);
      return undefined;
    }
    let alive = true;
    const done = () => {
      if (!alive) return;
      // Anything measured before the face arrived used fallback metrics.
      try {
        clearCache();
      } catch {
        /* ignore */
      }
      setReady((n) => n + 1);
    };
    // Pass the text: families split by unicode-range only load the parts it needs.
    Promise.resolve()
      .then(() => document.fonts.load(font, text || 'a'))
      .then(done, done);
    return () => {
      alive = false;
    };
  }, [font, text]);
  return ready;
}

/**
 * Lay a paragraph out line by line with a per-row width/inset function.
 * @returns {{ lines: { text: string, x: number, y: number, width: number }[], height: number, ready: boolean }}
 */
export function usePretextLines({ text, font = '18px Fraunces', lineHeight = 26, width, height, shape = 'none' }) {
  const ready = useFontReady(font, text);
  const prepared = useMemo(() => {
    if (!ready || typeof text !== 'string' || !text) return null;
    try {
      return prepareWithSegments(text, font);
    } catch (error) {
      console.warn('[PretextFlow] could not prepare text:', error);
      return null;
    }
  }, [ready, text, font]);

  return useMemo(() => {
    const usable = Number.isFinite(width) && width > 0 && lineHeight > 0;
    if (!prepared || !usable) return { lines: [], height: 0, ready: false };
    try {
      const flow = layoutFlow(prepared, {
        width,
        height,
        lineHeight,
        shape,
        minWidth: fontSizePx(font) * MIN_ROW_WIDTH_EM,
      });
      return { ...flow, ready: true };
    } catch (error) {
      console.warn('[PretextFlow] layout failed:', error);
      return { lines: [], height: 0, ready: false };
    }
  }, [prepared, width, height, lineHeight, shape, font]);
}

function useMeasuredWidth(ref, fixed) {
  const [measured, setMeasured] = useState(0);
  useEffect(() => {
    if (fixed != null) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    // Quarter-pixel rounding, as browsers do; avoids relayout churn on sub-pixel jitter.
    const read = () => setMeasured(Math.round(node.clientWidth * 4) / 4);
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, fixed]);
  return fixed ?? measured;
}

/**
 * Paragraph whose lines flow around a shape.
 *
 * @param {object} props
 * @param {string} props.text
 * @param {string} [props.font='18px Fraunces'] canvas font shorthand, px size, loaded family
 * @param {number} [props.lineHeight=26]
 * @param {number} [props.width] px; omitted = fill the parent and follow its size
 * @param {number} [props.height] px; omitted = as tall as the text
 * @param {'none'|'circle-right'|'circle-left'|'hourglass'|((y:number,lineHeight:number)=>{left:number,width:number,align?:'left'|'center'|'right'})} [props.shape='none']
 * @param {boolean} [props.reveal=true] staggered fade/slide-in per line
 */
export function PretextFlow({
  text,
  font = '18px Fraunces',
  lineHeight = 26,
  width,
  height,
  shape = 'none',
  reveal = true,
  className,
  style,
  ...rest
}) {
  const ref = useRef(null);
  const resolvedWidth = useMeasuredWidth(ref, width);
  const flow = usePretextLines({ text, font, lineHeight, width: resolvedWidth, height, shape });
  const lineStyle = { font, lineHeight: `${lineHeight}px`, height: lineHeight };

  return (
    <div
      ref={ref}
      className={cn('relative text-ink', className)}
      style={{ width: width ?? '100%', height: height ?? flow.height, ...style }}
      {...rest}
    >
      <span className="sr-only">{text}</span>
      {flow.lines.map((line, i) =>
        reveal ? (
          <motion.span
            key={i}
            aria-hidden="true"
            className="absolute whitespace-pre"
            style={{ ...lineStyle, left: line.x, top: line.y }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: Math.min(i * 0.045, 1.6), ease: [0.2, 0.7, 0.2, 1] }}
          >
            {line.text}
          </motion.span>
        ) : (
          <span
            key={i}
            aria-hidden="true"
            className="absolute whitespace-pre"
            style={{ ...lineStyle, left: line.x, top: line.y }}
          >
            {line.text}
          </span>
        ),
      )}
    </div>
  );
}

export default PretextFlow;
