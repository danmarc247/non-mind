// Dev gallery for the NON-MIND HUD bits. Open /bits-gallery.html with `npx vite`.
import '../../index.css';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasRevealEffect } from './CanvasRevealEffect';
import {
  CardSpotlight,
  Cryptic,
  EncryptedText,
  GlowingEffect,
  InkButton,
  Meter,
  MinimalCard,
  MinimalCardContent,
  MinimalCardDescription,
  MinimalCardImage,
  MinimalCardTitle,
  MovingBorderButton,
  NeumorphButton,
  NoiseBackground,
  Panel,
  ShaderLensBlur,
  StatChip,
  TextGenerateEffect,
  TextureButton,
  TextureCard,
  TextureCardContent,
  TextureCardDescription,
  TextureCardFooter,
  TextureCardHeader,
  TextureCardTitle,
  TextureSeparator,
  Tooltip,
  UnitCard,
  WavyBackground,
  toneVar,
} from './index';

const FLAVOR = [
  'the static thins when you name it',
  'a held breath is still a decision',
  'what you feed grows teeth',
  'calm is not the absence of weather',
];

const UNITS = [
  { name: 'Hush', tier: 1, cost: 1, stars: 1, aspects: [{ name: 'Calm', tone: 'teal' }], blob: ['teal', 'sky'] },
  { name: 'Prickle', tier: 2, cost: 2, stars: 2, aspects: [{ name: 'Spite', tone: 'magenta' }, { name: 'Edge', tone: 'tangerine' }], blob: ['magenta', 'tangerine'] },
  { name: 'Undertow', tier: 3, cost: 3, stars: 1, aspects: [{ name: 'Dread', tone: 'ultra' }, { name: 'Pull', tone: 'violet' }], blob: ['ultra', 'violet'] },
  { name: 'Lantern Moth', tier: 4, cost: 4, stars: 3, aspects: [{ name: 'Hope', tone: 'yolk' }, { name: 'Calm', tone: 'teal' }], blob: ['violet', 'yolk'] },
  { name: 'Wildfire', tier: 5, cost: 5, stars: 2, aspects: [{ name: 'Rage', tone: 'blood' }, { name: 'Joy', tone: 'yolk' }], blob: ['tangerine', 'blood'] },
];

/** Stand-in for the live WebGL thumbnail the game will mount in the card slot. */
function Thumb({ a, b }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(circle at 35% 38%, ${toneVar(a)} 0 28%, transparent 29%),
          radial-gradient(circle at 66% 64%, ${toneVar(b)} 0 24%, transparent 25%),
          radial-gradient(circle at 50% 50%, var(--color-paper) 0 60%, var(--color-paper-2) 61%)`,
      }}
    />
  );
}

function Label({ children }) {
  return (
    <div className="mb-3 inline-flex items-center rounded-[8px] border-[3px] border-ink bg-ink px-3 py-1 font-head text-sm tracking-[0.18em] text-paper uppercase shadow-[3px_4px_0_0_var(--color-paper)]">
      {children}
    </div>
  );
}

function Tile({ title, children, className }) {
  return (
    <div className={className}>
      <div className="mb-2 inline-block rounded-[6px] border-2 border-ink bg-paper px-2 py-0.5 font-stat text-[13px] text-ink">
        {title}
      </div>
      {children}
    </div>
  );
}

/** Loud painterly backdrop standing in for the 3D scene. */
function BusyBackdrop() {
  const blobs = [
    ['magenta', '8%', '12%', 420],
    ['ultra', '70%', '6%', 520],
    ['yolk', '42%', '38%', 380],
    ['teal', '86%', '52%', 440],
    ['tangerine', '14%', '70%', 460],
    ['violet', '58%', '82%', 500],
    ['sky', '30%', '96%', 360],
  ];
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <WavyBackground
        containerClassName="absolute inset-0 h-full"
        backgroundFill="#fbf6ec"
        waveOpacity={0.6}
        waveWidth={70}
        blur={6}
        speed="slow"
        colors={['#ff2d7a', '#2a2bff', '#ffd21f', '#17b5a6', '#8a3ffc']}
      />
      {blobs.map(([tone, x, y, s], i) => (
        <div
          key={i}
          className="absolute rounded-full border-[6px] border-ink/80 mix-blend-multiply"
          style={{
            left: x,
            top: y,
            width: s,
            height: s * 0.8,
            transform: `translate(-50%, -50%) rotate(${i * 37}deg)`,
            background: toneVar(tone),
            opacity: 0.7,
            borderRadius: '58% 42% 63% 37% / 45% 58% 42% 55%',
          }}
        />
      ))}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <path d="M-5 30 C 20 10, 40 60, 105 22" stroke="#1b1030" strokeWidth="0.9" fill="none" />
        <path d="M-5 78 C 30 50, 60 100, 105 64" stroke="#1b1030" strokeWidth="0.6" fill="none" />
        <path d="M20 -5 C 30 40, 10 70, 34 105" stroke="#fbf6ec" strokeWidth="1.4" fill="none" />
      </svg>
    </div>
  );
}

function Gallery() {
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState(3);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2200);
    return () => clearInterval(id);
  }, []);

  const calm = [0.72, 0.58, 0.81, 0.64][tick % 4];
  const arousal = [0.4, 0.62, 0.33, 0.51][tick % 4];
  const overwhelm = [0.88, 0.93, 0.84, 0.9][tick % 4];

  return (
    <div className="relative h-full overflow-auto">
      <BusyBackdrop />
      <main className="relative z-10 mx-auto flex max-w-[1320px] flex-col gap-8 px-8 py-8">
        {/* header */}
        <header className="flex items-end justify-between gap-6">
          <div className="rounded-[18px] border-[3px] border-ink bg-paper px-5 py-3 shadow-[3px_4px_0_0_var(--color-ink)]">
            <h1 className="font-title text-5xl leading-none text-ink">non-mind bits</h1>
            <p className="mt-1 text-base">
              <Cryptic text={FLAVOR[tick % FLAVOR.length]} />
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatChip label="Gold" value={42 + tick} tone="yolk" hint="Spend in the shop. +5 per round, +1 per 10 banked." />
            <StatChip label="Round" value="7/20" tone="ultra" />
            <StatChip label="Lives" value={3} tone="blood" hint="Lose one each time the storm wins." />
            <StatChip label="Streak" value="+4" tone="leaf" />
          </div>
        </header>

        {/* HUD panels */}
        <section>
          <Label>Kit · HUD</Label>
          <div className="grid grid-cols-3 items-stretch gap-6">
            <Panel title="Regulation" tone="teal" glow>
              <div className="flex flex-col gap-3">
                <Meter label="Calm" value={calm} tone="teal" />
                <Meter label="Arousal" value={arousal} tone="tangerine" />
                <Meter label="Overwhelm" value={overwhelm} tone="magenta" danger />
                <p className="text-sm leading-snug text-ink-2">
                  <Cryptic text="Overwhelm past 85% shatters the weakest unit." tone="blood" />
                </p>
              </div>
            </Panel>

            <Panel title="Actions" tone="yolk">
              <div className="flex flex-col gap-5 pt-1">
                <div className="flex flex-wrap items-center gap-4">
                  <InkButton tone="yolk" size="lg" hotkey="space">Fight</InkButton>
                  <InkButton tone="magenta" hotkey="r">Reroll</InkButton>
                  <InkButton tone="teal" size="sm" hotkey="f">Lock</InkButton>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <InkButton tone="ultra" hotkey="e">Level up</InkButton>
                  <InkButton tone="tangerine" disabled hotkey="d">Sold out</InkButton>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <InkButton tone="violet" size="sm" pressed>Pressed</InkButton>
                  <InkButton tone="paper" size="sm">Paper</InkButton>
                  <InkButton tone="ink" size="sm">Ink</InkButton>
                  <InkButton tone="leaf" size="sm">Leaf</InkButton>
                </div>
              </div>
            </Panel>

            <Panel title="Inspector" tone="violet" bodyClassName="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                <StatChip label="Atk" value={12} tone="blood" />
                <StatChip label="Hp" value={38} tone="leaf" />
                <StatChip label="Spd" value="1.2" tone="sky" />
              </div>
              <div className="flex items-center gap-3">
                <Tooltip
                  open
                  side="bottom"
                  content={
                    <>
                      <div className="font-head text-base tracking-wide text-ink uppercase">Undertow</div>
                      <div>Pulls the nearest enemy one tile closer. Synergy with <b className="text-ultra">Dread</b> at 3.</div>
                    </>
                  }
                >
                  <span className="cursor-help rounded-[8px] border-2 border-dashed border-ink px-2 py-1 font-head text-sm text-ink uppercase">
                    tooltip (forced open)
                  </span>
                </Tooltip>
                <Tooltip content="Hover tooltips render in a portal." side="right">
                  <span className="rounded-[8px] border-2 border-ink bg-paper-2 px-2 py-1 font-head text-sm text-ink uppercase">
                    hover me
                  </span>
                </Tooltip>
              </div>
            </Panel>
          </div>
        </section>

        {/* shop */}
        <section>
          <Label>Kit · Shop &amp; bench</Label>
          <Panel title="Shop" tone="magenta" bodyClassName="flex flex-wrap items-start gap-5 px-5 py-5">
            {UNITS.map((u, i) => (
              <UnitCard
                key={u.name}
                name={u.name}
                tier={u.tier}
                cost={u.cost}
                stars={u.stars}
                aspects={u.aspects}
                selected={selected === i}
                dim={i === 4 && tick % 2 === 1}
                onClick={() => setSelected(i)}
              >
                <Thumb a={u.blob[0]} b={u.blob[1]} />
              </UnitCard>
            ))}
            <div className="mx-2 w-[3px] self-stretch rounded-full bg-ink/20" />
            <UnitCard name="Empty slot" tier={1} aspects={[]} dim />
            <UnitCard name="Wildfire" tier={5} cost={5} stars={3} dim aspects={UNITS[4].aspects}>
              <Thumb a="tangerine" b="blood" />
            </UnitCard>
          </Panel>
        </section>

        {/* ports */}
        <section>
          <Label>Ports · Aceternity UI</Label>
          <div className="grid grid-cols-4 gap-6">
            <Tile title="glowingeffect">
              <div className="relative h-40 rounded-[18px] border-[3px] border-ink bg-paper p-4 shadow-[3px_4px_0_0_var(--color-ink)]">
                <GlowingEffect disabled={false} glow spread={40} proximity={64} inactiveZone={0.01} borderWidth={4} />
                <div className="font-head text-xl text-ink uppercase">Move near me</div>
                <p className="mt-1 text-sm text-ink-2">Conic paint ring follows the pointer.</p>
              </div>
            </Tile>
            <Tile title="encryptedtext + textgenerate">
              <div className="h-40 rounded-[18px] border-[3px] border-ink bg-paper p-4 shadow-[3px_4px_0_0_var(--color-ink)]">
                <EncryptedText text="THE STORM IS LISTENING" className="font-head text-xl" encryptedClassName="text-ultra/60" />
                <TextGenerateEffect words="quiet hands make quiet weather" className="mt-2" />
              </div>
            </Tile>
            <Tile title="movingborder">
              <div className="flex h-40 items-center justify-center rounded-[18px] border-[3px] border-ink bg-paper-2 shadow-[3px_4px_0_0_var(--color-ink)]">
                <MovingBorderButton tone="magenta" duration={2600}>
                  Begin round
                </MovingBorderButton>
              </div>
            </Tile>
            <Tile title="noisebackground">
              <NoiseBackground containerClassName="h-40" className="flex h-full flex-col justify-end p-2" noiseIntensity={0.35}>
                <div className="font-head text-2xl text-ink uppercase">Grain</div>
                <div className="text-sm text-ink-2">Drifting paint under paper grain.</div>
              </NoiseBackground>
            </Tile>
            <Tile title="cardspotlight (hover)">
              <CardSpotlight className="h-44 p-5 shadow-[3px_4px_0_0_var(--color-ink)]" tone="ultra" radius={220}>
                <div className="relative z-10">
                  <div className="font-head text-xl text-ink uppercase">Spotlight</div>
                  <p className="mt-1 text-sm text-ink-2">Dot matrix mounts only on hover.</p>
                </div>
              </CardSpotlight>
            </Tile>
            <Tile title="canvasreveal">
              <div className="relative h-44 overflow-hidden rounded-[18px] border-[3px] border-ink shadow-[3px_4px_0_0_var(--color-ink)]">
                <CanvasRevealEffect animationSpeed={3} tone="violet" colors={[[138, 63, 252], [255, 45, 122]]} dotSize={3} showGradient={false} />
                <div className="absolute bottom-3 left-4 font-head text-xl text-ink uppercase">Reveal</div>
              </div>
            </Tile>
            <Tile title="wavybackground" className="col-span-2">
              <div className="relative h-44 overflow-hidden rounded-[18px] border-[3px] border-ink shadow-[3px_4px_0_0_var(--color-ink)]">
                <WavyBackground containerClassName="h-full" waveOpacity={0.5} blur={8} waveWidth={40}>
                  <div className="font-title text-4xl text-ink">ebb &amp; flow</div>
                </WavyBackground>
              </div>
            </Tile>
          </div>
        </section>

        <section className="pb-16">
          <Label>Ports · Cult UI</Label>
          <div className="grid grid-cols-4 gap-6">
            <Tile title="texturecard">
              <TextureCard>
                <TextureCardHeader className="px-4">
                  <TextureCardTitle>Run summary</TextureCardTitle>
                  <TextureCardDescription>Seven rounds survived.</TextureCardDescription>
                </TextureCardHeader>
                <TextureSeparator />
                <TextureCardContent className="text-sm text-ink">Best unit: Lantern Moth (3 stars).</TextureCardContent>
                <TextureSeparator />
                <TextureCardFooter>
                  <TextureButton variant="secondary" size="sm" className="w-auto">Close</TextureButton>
                  <TextureButton variant="accent" tone="magenta" size="sm" className="w-auto">Again</TextureButton>
                </TextureCardFooter>
              </TextureCard>
            </Tile>
            <Tile title="texturebutton">
              <div className="flex flex-col gap-3 rounded-[18px] border-[3px] border-ink bg-paper p-4 shadow-[3px_4px_0_0_var(--color-ink)]">
                <TextureButton variant="primary">Primary</TextureButton>
                <TextureButton variant="accent" tone="teal">Accent · teal</TextureButton>
                <TextureButton variant="destructive">Destructive</TextureButton>
                <TextureButton variant="secondary">Secondary</TextureButton>
                <TextureButton variant="minimal">Minimal</TextureButton>
              </div>
            </Tile>
            <Tile title="minimalcard">
              <MinimalCard>
                <MinimalCardImage className="h-[110px]">
                  <Thumb a="ultra" b="yolk" />
                </MinimalCardImage>
                <MinimalCardTitle>Aspect: Dread</MinimalCardTitle>
                <MinimalCardDescription>At 3: enemies start the round slowed.</MinimalCardDescription>
              </MinimalCard>
            </Tile>
            <Tile title="neumorphbutton">
              <div className="flex flex-col items-start gap-3 rounded-[18px] border-[3px] border-ink bg-paper p-4 shadow-[3px_4px_0_0_var(--color-ink)]">
                <div className="flex flex-wrap gap-3">
                  <NeumorphButton>Default</NeumorphButton>
                  <NeumorphButton intent="primary">Primary</NeumorphButton>
                </div>
                <div className="flex flex-wrap gap-3">
                  <NeumorphButton intent="secondary" size="small">Secondary</NeumorphButton>
                  <NeumorphButton intent="danger" size="small">Danger</NeumorphButton>
                  <NeumorphButton intent="tone" tone="yolk" size="small" loading>Saving</NeumorphButton>
                </div>
                <NeumorphButton intent="tone" tone="teal" size="large" fullWidth>Breathe</NeumorphButton>
              </div>
            </Tile>
            <Tile title="shaderlensblur" className="col-span-2">
              <ShaderLensBlur height="220px" variation={3} />
            </Tile>
            <Tile title="shaderlensblur · ring" className="col-span-2">
              <ShaderLensBlur height="220px" variation={0} showHint={false} />
            </Tile>
          </div>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
