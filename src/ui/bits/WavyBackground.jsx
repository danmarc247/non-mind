// Ported from Aceternity UI "Wavy Background" (ui.aceternity.com), restyled for NON-MIND.
// Thick blurred simplex-noise strokes on a 2D canvas. Sized to its container (the
// original sized to the window and overwrote window.onresize).
import { useEffect, useMemo, useRef, useState } from 'react';
import { createNoise3D } from 'simplex-noise';
import { cn } from '../../lib/cn';

const DEFAULT_COLORS = ['#ff2d7a', '#2a2bff', '#ffd21f', '#17b5a6', '#ff7a1a'];

export const WavyBackground = ({
  children,
  className,
  containerClassName,
  colors,
  waveWidth,
  backgroundFill,
  blur = 10,
  speed = 'fast',
  waveOpacity = 0.5,
  waveCount = 5,
  ...props
}) => {
  const noise = useMemo(() => createNoise3D(), []);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const opts = useRef({});
  opts.current = {
    colors: colors ?? DEFAULT_COLORS,
    waveWidth: waveWidth || 50,
    backgroundFill: backgroundFill || '#fbf6ec',
    blur,
    speed: speed === 'fast' ? 0.002 : 0.001,
    waveOpacity: waveOpacity || 0.5,
    waveCount,
  };

  const [isSafari, setIsSafari] = useState(false);
  useEffect(() => {
    setIsSafari(navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome'));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let nt = 0;
    let animationId = 0;

    const resize = () => {
      w = ctx.canvas.width = wrap.clientWidth || window.innerWidth;
      h = ctx.canvas.height = wrap.clientHeight || window.innerHeight;
      ctx.filter = `blur(${opts.current.blur}px)`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const drawWave = (n) => {
      const o = opts.current;
      nt += o.speed;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.lineWidth = o.waveWidth;
        ctx.strokeStyle = o.colors[i % o.colors.length];
        for (let x = 0; x < w; x += 5) {
          const y = noise(x / 800, 0.3 * i, nt) * 100;
          ctx.lineTo(x, y + h * 0.5);
        }
        ctx.stroke();
        ctx.closePath();
      }
    };

    const render = () => {
      const o = opts.current;
      ctx.fillStyle = o.backgroundFill;
      ctx.globalAlpha = o.waveOpacity;
      ctx.fillRect(0, 0, w, h);
      drawWave(o.waveCount);
      animationId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationId);
      ro.disconnect();
    };
  }, [noise]);

  return (
    <div
      ref={wrapRef}
      className={cn('relative flex h-screen flex-col items-center justify-center overflow-hidden', containerClassName)}
    >
      <canvas
        className="absolute inset-0 z-0 h-full w-full"
        ref={canvasRef}
        style={isSafari ? { filter: `blur(${blur}px)` } : undefined}
      />
      <div className={cn('relative z-10', className)} {...props}>
        {children}
      </div>
    </div>
  );
};

export default WavyBackground;
