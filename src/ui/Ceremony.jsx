// Ceremony: the big moments, staged as short GSAP timelines over everything (pointer-events none).
// stage unlock, a link of 5+, an ending, the wave's arc, the reset. One timeline at a time:
// a new ceremony of equal or higher weight kills the running one; a lighter one waits its turn by being dropped.
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { STAGES, LINKS, WAVE_ARC } from '../game/data.js';
import { onEvent } from '../game/store.js';
import { unitColors } from '../gfx/palettes/families.js';
import { headFamily } from './lineage/log.js';
import { TONES } from './type/tones.js';

const WEIGHT = { wave: 0, ladder: 1, stage: 2, ending: 3, reset: 4 };
// arc banner paint: light tones carry ink text, dark ones carry paper (contrast rule)
const ARC_TONE = ['sky', 'rose', 'teal', 'tangerine', 'yolk', 'sky', 'rose', 'teal', 'yolk', 'magenta'];
const DARK = new Set(['magenta', 'ultra', 'violet', 'blood', 'ink']);
const ENDING_LINE = 'An ending is known. It stays known.';
const RESET_LINE = 'Simple again.';
const css = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(' ')})`;
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function letters(el, text) {
  el.textContent = '';
  return [...text].map((ch) => {
    const s = document.createElement('span');
    s.textContent = ch === ' ' ? ' ' : ch;
    s.style.display = 'inline-block';
    el.appendChild(s);
    return s;
  });
}

export default function Ceremony() {
  const R = {
    root: useRef(null), stage: useRef(null), word: useRef(null), under: useRef(null), hint: useRef(null),
    ladder: useRef(null), pips: useRef(null), pali: useRef(null), ltext: useRef(null),
    ending: useRef(null), ring: useRef(null), ringIn: useRef(null), eline: useRef(null), etext: useRef(null),
    wave: useRef(null), swipe: useRef(null), arc: useRef(null), wnum: useRef(null),
    reset: useRef(null), wipe: useRef(null), rword: useRef(null), rline: useRef(null),
  };
  const run = useRef({ tl: null, w: -1, end: 0 });

  useEffect(() => {
    const layers = () => [R.stage, R.ladder, R.ending, R.wave, R.reset].map((r) => r.current);
    gsap.set(layers(), { autoAlpha: 0 });

    function play(kind, o = {}) {
      const cur = run.current;
      if (cur.tl && performance.now() < cur.end && WEIGHT[kind] < cur.w) return null;
      if (cur.tl) cur.tl.kill();
      gsap.set(layers(), { autoAlpha: 0, clearProps: 'transform' });
      const calm = o.reduced ?? reduced();
      const tl = gsap.timeline({ onComplete: () => { gsap.set(layers(), { autoAlpha: 0 }); run.current.tl = null; } });
      run.current = { tl, w: WEIGHT[kind] };
      BUILD[kind](tl, o, calm);
      run.current.end = performance.now() + tl.duration() * 1000;
      if (o.seek != null) tl.pause(o.seek);
      return tl;
    }

    const BUILD = {
      stage(tl, o, calm) {
        const s = STAGES[o.stage ?? 1] || STAGES[1];
        const ls = letters(R.word.current, s.id.toUpperCase());
        R.hint.current.textContent = s.hint;
        const path = R.under.current, len = path.getTotalLength();
        tl.set(R.stage.current, { autoAlpha: 1 });
        if (calm) {
          gsap.set(path, { strokeDasharray: len, strokeDashoffset: 0 });
          tl.fromTo(R.stage.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0).to(R.stage.current, { autoAlpha: 0, duration: 0.25 }, 1.5);
          return;
        }
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
        tl.fromTo(ls, { y: 70, scale: 0.3, rotation: () => gsap.utils.random(-28, 28), autoAlpha: 0 },
          { y: 0, scale: 1, rotation: () => gsap.utils.random(-5, 5), autoAlpha: 1, duration: 0.32, ease: 'back.out(1.8)', stagger: 0.045 }, 0)
          .to(path, { strokeDashoffset: 0, duration: 0.34, ease: 'power2.out' }, 0.22 + ls.length * 0.03)
          .fromTo(R.hint.current, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.26, ease: 'power2.out' }, 0.5)
          .to(ls, { y: -22, autoAlpha: 0, duration: 0.2, ease: 'power2.in', stagger: 0.02 }, 1.42)
          .to([path, R.hint.current], { autoAlpha: 0, duration: 0.2, ease: 'power2.in' }, 1.5)
          .set(R.stage.current, { autoAlpha: 0 }, 1.8);
      },
      ladder(tl, o, calm) {
        const n = Math.max(1, Math.min(12, o.link || 5)), fam = o.family || 'sublimation';
        const pips = [...R.pips.current.children];
        pips.forEach((p, i) => {
          const c = unitColors(fam, Math.round(4 + (i * 8) / 11));
          p.style.setProperty('--fill', css(c.a));
          gsap.set(p, { backgroundColor: i < n - 1 ? css(c.a) : TONES.paper, scale: 1 });
        });
        R.pali.current.textContent = LINKS[n - 1].pali;
        R.ltext.current.textContent = LINKS[n - 1].text;
        const last = pips[n - 1];
        tl.set(R.ladder.current, { autoAlpha: 1 });
        if (calm) {
          gsap.set(last, { backgroundColor: last.style.getPropertyValue('--fill') });
          tl.fromTo(R.ladder.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0).to(R.ladder.current, { autoAlpha: 0, duration: 0.25 }, 1.3);
          return;
        }
        tl.fromTo(R.ladder.current, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.24, ease: 'power2.out' }, 0)
          .fromTo(pips.slice(0, n - 1), { scale: 0.6 }, { scale: 1, duration: 0.22, ease: 'back.out(2)', stagger: 0.03 }, 0.05)
          .to(last, { backgroundColor: last.style.getPropertyValue('--fill'), scale: 1.45, duration: 0.2, ease: 'power2.out' }, 0.12 + n * 0.03)
          .to(last, { scale: 1, duration: 0.3, ease: 'back.out(3)' })
          .fromTo([R.pali.current, R.ltext.current], { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.24, stagger: 0.08 }, 0.3)
          .to(R.ladder.current, { y: -14, autoAlpha: 0, duration: 0.24, ease: 'power2.in' }, 1.35);
      },
      ending(tl, o, calm) {
        R.etext.current.textContent = o.text || ENDING_LINE;
        const ln = R.eline.current, len = ln.getTotalLength();
        tl.set(R.ending.current, { autoAlpha: 1 });
        if (calm) {
          gsap.set(ln, { strokeDasharray: len, strokeDashoffset: 0 });
          tl.fromTo(R.ending.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0).to(R.ending.current, { autoAlpha: 0, duration: 0.4 }, 2.2);
          return;
        }
        gsap.set(ln, { strokeDasharray: len, strokeDashoffset: len });
        tl.fromTo([R.ring.current, R.ringIn.current], { scale: 0.15, autoAlpha: 0, transformOrigin: '50% 50%' },
          { scale: 1, autoAlpha: 1, duration: 1.6, ease: 'power2.out', stagger: 0.12 }, 0)
          .to(ln, { strokeDashoffset: 0, duration: 0.9, ease: 'power1.inOut' }, 0.5)
          .fromTo(R.etext.current, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power2.out' }, 0.9)
          .to([R.ring.current, R.ringIn.current], { scale: 1.25, autoAlpha: 0, duration: 0.8, ease: 'power1.in' }, 2.0)
          .to([ln, R.etext.current], { autoAlpha: 0, duration: 0.6 }, 2.1);
      },
      wave(tl, o, calm) {
        const i = ((o.wave || 1) - 1) % 10, arc = WAVE_ARC[i], tone = ARC_TONE[i];
        R.arc.current.textContent = arc.name;
        R.arc.current.style.color = `var(--color-${DARK.has(tone) ? 'paper' : 'ink'})`;
        R.wnum.current.textContent = `wave ${o.wave || 1}`;
        const sw = R.swipe.current, len = sw.getTotalLength();
        sw.style.stroke = `var(--color-${tone})`;
        tl.set(R.wave.current, { autoAlpha: 1 });
        if (calm) {
          gsap.set(sw, { strokeDasharray: len, strokeDashoffset: 0 });
          tl.fromTo(R.wave.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0).to(R.wave.current, { autoAlpha: 0, duration: 0.25 }, 0.95);
          return;
        }
        gsap.set(sw, { strokeDasharray: len, strokeDashoffset: len });
        tl.to(sw, { strokeDashoffset: 0, duration: 0.3, ease: 'power3.out' }, 0)
          .fromTo(R.arc.current, { x: -70, autoAlpha: 0, skewX: -12 }, { x: 0, autoAlpha: 1, skewX: 0, duration: 0.3, ease: 'back.out(1.6)' }, 0.1)
          .fromTo(R.wnum.current, { x: -30, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.22, ease: 'power2.out' }, 0.18)
          .to([R.arc.current, R.wnum.current], { x: 60, autoAlpha: 0, duration: 0.22, ease: 'power2.in' }, 0.9)
          .to(sw, { strokeDashoffset: -len, duration: 0.28, ease: 'power2.in' }, 0.92);
      },
      reset(tl, o, calm) {
        const ls = letters(R.rword.current, 'NON-MIND');
        R.rline.current.textContent = o.text || RESET_LINE;
        tl.set(R.reset.current, { autoAlpha: 1 });
        if (calm) {
          gsap.set(R.wipe.current, { scaleX: 1 });
          tl.fromTo(R.reset.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0).to(R.reset.current, { autoAlpha: 0, duration: 0.4 }, 1.9);
          return;
        }
        tl.fromTo(R.wipe.current, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.42, ease: 'power3.inOut' }, 0)
          .fromTo(ls, { y: 50, scale: 0.4, autoAlpha: 0, rotation: () => gsap.utils.random(-20, 20) },
            { y: 0, scale: 1, autoAlpha: 1, rotation: 0, duration: 0.34, ease: 'back.out(1.7)', stagger: 0.05 }, 0.3)
          .fromTo(R.rline.current, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 0.85)
          .to([...ls, R.rline.current], { autoAlpha: 0, y: -12, duration: 0.25, ease: 'power2.in', stagger: 0.02 }, 1.6)
          .set(R.wipe.current, { transformOrigin: '100% 50%' }, 1.85)
          .to(R.wipe.current, { scaleX: 0, duration: 0.55, ease: 'power2.inOut' }, 1.85);
      },
    };

    const off = onEvent((e, G) => {
      if (e.type === 'stage') play('stage', { stage: e.stage });
      else if (e.type === 'link' && e.link >= 5) {
        const u = G?.units.find((x) => x.id === e.id);
        play('ladder', { link: e.link, family: u ? headFamily(u.g) : undefined });
      } else if (e.type === 'ending') play('ending');
      else if (e.type === 'waveStart') play('wave', { wave: e.wave });
      else if (e.type === 'reset') play('reset');
    });
    const demo = { stage: { stage: 6 }, ladder: { link: 7, family: 'sublimation' }, ending: {}, wave: { wave: 3 }, reset: {} };
    window.__ceremony = (kind, o = {}) => (BUILD[kind] ? !!play(kind, { ...demo[kind], ...o }) : false);
    return () => { off(); run.current.tl?.kill(); delete window.__ceremony; };
  }, []);

  return (
    <div ref={R.root} className="pointer-events-none fixed inset-0 z-[45] overflow-hidden" aria-hidden="true">
      {/* stage unlock */}
      <div ref={R.stage} className="absolute inset-x-0 top-[30%] flex flex-col items-center">
        <div ref={R.word} className="font-title text-[clamp(56px,9vw,132px)] leading-none text-magenta [text-shadow:3px_4px_0_var(--color-ink),7px_8px_0_var(--color-ultra)]" />
        <svg className="-mt-1 h-6 w-[min(520px,70vw)]" viewBox="0 0 520 24" preserveAspectRatio="none">
          <path ref={R.under} d="M8 14 C 90 4, 160 22, 260 12 S 420 4, 512 13" fill="none" stroke="var(--color-yolk)" strokeWidth="9" strokeLinecap="round" />
        </svg>
        <p ref={R.hint} className="mt-2 rounded-full bg-paper/85 px-4 py-1 font-body text-[clamp(15px,1.6vw,20px)] italic text-ink" />
      </div>
      {/* the ladder: link 5 and up */}
      <div ref={R.ladder} className="absolute inset-x-0 top-[26%] flex flex-col items-center gap-2">
        <div ref={R.pips} className="flex gap-2.5 rounded-full border-[3px] border-ink bg-paper px-5 py-2.5 shadow-[3px_4px_0_var(--color-ink)]">
          {Array.from({ length: 12 }, (_, i) => <span key={i} className="block h-5 w-5 rounded-full border-[3px] border-ink" />)}
        </div>
        <div ref={R.pali} className="font-head text-[clamp(26px,3.2vw,40px)] leading-none text-ink [text-shadow:2px_2px_0_var(--color-paper)]" />
        <p ref={R.ltext} className="rounded-full bg-paper/85 px-3 py-0.5 font-body text-[15px] italic text-ink-2" />
      </div>
      {/* an ending */}
      <div ref={R.ending} className="absolute inset-0 flex flex-col items-center justify-center">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
          <g ref={R.ring}><circle cx="500" cy="500" r="300" fill="none" stroke="var(--color-ink)" strokeWidth="20" opacity="0.35" /><circle cx="500" cy="500" r="300" fill="none" stroke="var(--color-paper)" strokeWidth="13" /></g>
          <g ref={R.ringIn}><circle cx="500" cy="500" r="250" fill="none" stroke="var(--color-paper)" strokeWidth="4" opacity="0.9" /></g>
          <path ref={R.eline} d="M120 500 L 880 500" stroke="var(--color-paper)" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <p ref={R.etext} className="relative mt-24 rounded-full bg-paper px-4 py-1 font-body text-[clamp(16px,1.7vw,22px)] italic text-ink shadow-[2px_3px_0_var(--color-ink)]" />
      </div>
      {/* the wave's arc */}
      <div ref={R.wave} className="absolute inset-x-0 top-[22%] flex justify-center">
        <div className="relative flex h-[92px] w-[min(760px,92vw)] items-center justify-center">
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 760 92" preserveAspectRatio="none">
            <path ref={R.swipe} d="M24 54 C 160 30, 300 62, 420 44 S 640 34, 738 46" fill="none" strokeWidth="58" strokeLinecap="round" />
          </svg>
          <div className="relative flex items-baseline gap-3">
            <span ref={R.wnum} className="font-stat text-[13px] text-ink-2" />
            <span ref={R.arc} className="font-head text-[clamp(26px,3.4vw,42px)] leading-none" />
          </div>
        </div>
      </div>
      {/* the reset */}
      <div ref={R.reset} className="absolute inset-0 flex flex-col items-center justify-center">
        <div ref={R.wipe} className="absolute inset-0 bg-paper" />
        <div ref={R.rword} className="relative font-title text-[clamp(64px,11vw,168px)] leading-[0.9] text-ink [text-shadow:5px_6px_0_var(--color-magenta),10px_12px_0_var(--color-ultra)]" />
        <p ref={R.rline} className="relative mt-5 font-body text-[clamp(16px,1.6vw,21px)] italic text-ink-2" />
      </div>
    </div>
  );
}
