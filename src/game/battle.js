// Auto-battle: continuous 2D simulation on a disc. Regulators hold seats around the center;
// stressors arrive through 10 gates in 10 beats and walk toward the core (composure).
import { STRESSORS, STRESSOR, WAVE_ARC, ABILITIES, ASPECT_THRESHOLDS, ASPECTS, ASPECT_IDS, BEATS_PER_WAVE, DIRECTIONS, STANCES, FAMILY } from './data.js';
import { baseStats, aspectsOf, abilityOf, echoAbilityOf, leaves } from './genome.js';
import { LINKS } from './data.js';

export const ARENA = { rings: [3.2, 5.4, 7.6], gate: 10.5, core: 1.3 };
export const BEAT_TIME = 2.4;

export const seatPos = (ring, dir) => {
  const a = (dir / DIRECTIONS) * Math.PI * 2 + (ring % 2 ? Math.PI / DIRECTIONS : 0);
  const r = ARENA.rings[ring];
  return [Math.cos(a) * r, Math.sin(a) * r];
};
export const gatePos = (dir) => { const a = (dir / DIRECTIONS) * Math.PI * 2; return [Math.cos(a) * ARENA.gate, Math.sin(a) * ARENA.gate]; };

const count = (arr, v) => arr.reduce((n, x) => n + (x === v ? 1 : 0), 0);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Active aspect tiers (0..3) for the seated units.
export function aspectTiers(G, arc) {
  const out = {};
  const seated = G.units.filter((u) => u.seat);
  const wild = G.stage >= 16 ? 1 : 0;
  for (const a of ASPECT_IDS) {
    let n = wild;
    const seen = new Set();
    for (const u of seated) {
      const fade = u.traits.includes('fade');
      if (fade || aspectsOf(u.g).includes(a)) { const k = leaves(u.g)[0].f; if (!seen.has(k) || fade) { seen.add(k); n++; } }
    }
    let tier = 0;
    for (const t of ASPECT_THRESHOLDS) if (n >= t) tier++;
    out[a] = arc?.mod.noAspects ? 0 : tier;
    out[a + '_n'] = n;
  }
  return out;
}
const av = (tiers, a) => (tiers[a] ? ASPECTS[a].v[tiers[a] - 1] : 0);

export function unitStats(G, u, tiers) {
  const s = baseStats(u.g);
  const m = LINKS[u.link - 1].mult;
  const stance = STANCES.find((x) => x.id === G.stance)?.mod || {};
  const asp = aspectsOf(u.g);
  const fade = u.traits.includes('fade');
  const has = (a) => fade || asp.includes(a);
  let tol = s.tol * m * (stance.tol || 1), sal = s.sal * m * (stance.sal || 1);
  if (has('somatic')) tol *= 1 + av(tiers, 'somatic') / 100;
  if (has('limbic')) sal *= 1 + av(tiers, 'limbic') / 100;
  if (G.upgrades.crowd) sal *= 1 + G.complexity / 60;
  // the incremental layer feeds the board: lifetime yield and residue both strengthen regulators
  const momentum = (1 + 0.12 * Math.log10(1 + G.stats.earned)) * (1 + 0.05 * Math.pow(G.mu, 0.7));
  sal *= (1 + 0.1 * G.endings) * momentum; tol *= momentum;
  return {
    tol, sal, lat: Math.max(0.15, s.lat), reach: s.reach * (stance.reach || 1),
    opa: Math.min(80, s.opa + (stance.opa || 0) + (has('void') ? av(tiers, 'void') : 0)),
    lab: s.lab, rec: s.rec + (G.upgrades.second_arrow ? 10 : 0), aspects: asp,
  };
}

export function startWave(G) {
  const gw = G.cycle * 10 + G.wave;
  const arc = WAVE_ARC[(G.wave - 1) % 10];
  const tiers = aspectTiers(G, arc);
  const B = (G.battle = { units: [], enemies: [], beat: 0, beatT: 0.8, arc, tiers, gw, t: 0, nextId: 1, label: 0 });
  for (const u of G.units) {
    if (!u.seat) continue;
    const st = unitStats(G, u, tiers);
    const [x, z] = seatPos(u.seat.ring, u.seat.dir);
    const tc = {}; for (const t of u.traits) tc[t] = (tc[t] || 0) + 1;
    B.units.push({
      id: B.nextId++, uid: u.id, side: 0, x, z, hx: x, hz: z, hp: st.tol, max: st.tol, ...st,
      cd: 0.3 + G.rng() * 0.5, charge: 0, ability: abilityOf(u.g), echo: G.stage >= 12 ? echoAbilityOf(u.g) : null,
      tr: tc, veil: (tc.trust || 0) * 0.25 * st.tol, store: 0, hits: 0, last: 0, streak: 0, alive: true, stun: 0, hide: 0, taunt: 0, hard: 1,
    });
  }
  G.phase = 'fight'; G.phaseT = 0;
  G.events.push({ type: 'waveStart', wave: G.wave, arc: arc.id });
}

function spawnBeat(G) {
  const B = G.battle, { arc, gw } = B, mod = arc.mod;
  const beat = B.beat;
  const pool = STRESSORS.filter((s) => !s.boss).slice(0, Math.min(5, 1 + Math.floor((gw + 1) / 2)));
  const scale = Math.pow(1.15, gw - 1) * (1 + 2 * G.overwhelm) * (1 + 0.5 * G.mirrors);
  let n = 1 + Math.floor(gw / 4) + (beat % 5 === 4 ? 1 : 0);
  if (mod.countMul) n *= mod.countMul;
  if (mod.jitter) n = Math.max(1, Math.round(n * (0.4 + G.rng() * 1.6)));
  if (mod.byClicks) n = Math.max(1, Math.min(n * 3, Math.round(n * 0.5 + G.clicksThisWave / 12)));
  if (G.moods.filter((m) => m.kind === 'dread').length >= 3) n = Math.ceil(n * 1.5);
  if (mod.fuse) n = beat === 0 ? 1 : 0;
  n = Math.min(n, 14);
  const gate0 = (beat * 3 + G.wave + G.cycle) % DIRECTIONS;
  const shadow = 1 - av(B.tiers, 'shadow') / 100;
  const mk = (def, gate, mulT = 1, mulS = 1, extra = {}) => {
    const [gx, gz] = gatePos(gate), j = () => (G.rng() - 0.5) * 1.6;
    const tol = def.tol * scale * mulT * (mod.tolMul || 1) * shadow;
    B.enemies.push({
      id: B.nextId++, side: 1, def: def.id, x: gx + j(), z: gz + j(), hp: tol, max: tol, sal: def.sal * Math.pow(1.1, gw - 1) * mulS * (mod.salMul || 1),
      lat: def.lat, reach: def.reach, speed: def.speed, opa: mod.opa || 0, cd: G.rng(), alive: true, stun: 0, mark: 0, value: def.value,
      form: mod.mirrorForms && B.units.length ? { mirror: B.units[Math.floor(G.rng() * B.units.length)].uid } : null, flip: 0, ...extra,
    });
  };
  for (let i = 0; i < n; i++) {
    const def = pool[Math.floor(G.rng() * pool.length)];
    mk(def, mod.allGates ? Math.floor(G.rng() * DIRECTIONS) : (gate0 + (i % 3 === 2 ? 5 : 0)) % DIRECTIONS);
  }
  if (mod.fuse && beat === 0) B.enemies[B.enemies.length - 1] = Object.assign(B.enemies[B.enemies.length - 1], { hp: STRESSOR.shame.tol * scale * 6, max: STRESSOR.shame.tol * scale * 6, def: 'shame', fuse: 6 + Math.floor(gw / 2), speed: 0.5 });
  if ((mod.boss || G.wave === 10) && beat === BEATS_PER_WAVE - 1) mk(STRESSOR.abandonment, gate0, 1 + G.cycle, 1, { boss: true });
  G.events.push({ type: 'beat', beat, gate: gate0 });
}

function harm(G, src, tgt, raw, opts = {}) {
  const B = G.battle;
  if (!tgt.alive) return 0;
  if (!opts.sure && !(src?.tr?.see) && G.rng() * 100 < (tgt.opa || 0) + (tgt.hide > 0 ? 100 : 0)) { G.events.push({ type: 'miss', x: tgt.x, z: tgt.z }); return 0; }
  let d = raw;
  if (tgt.side === 1 && tgt.mark > 0) d *= 2;
  if (tgt.side === 1 && G.labelT > 0) d *= 2;
  if (tgt.side === 0) {
    d /= tgt.hard; if (G.upgrades.second_arrow) d *= 1.1;
    const share = av(B.tiers, 'relational') / 100;
    if (share && tgt.aspects.includes('relational') && !opts.shared) {
      const near = B.units.filter((o) => o.alive && o !== tgt && dist(o, tgt) < 3.5);
      if (near.length) { const part = (d * share) / near.length; d *= 1 - share; for (const o of near) harm(G, src, o, part, { sure: true, shared: true }); }
    }
    if (tgt.veil > 0 && !(src?.tr?.see)) { const a = Math.min(tgt.veil, d); tgt.veil -= a; d -= a; }
    if (tgt.ability === 'lid') tgt.store += d * ABILITIES.lid.power;
    tgt.charge += (d / tgt.max) * 45;
  }
  if (src?.oneShot && tgt.side === 1 && G.rng() < src.oneShot) d = Math.max(d, tgt.hp);
  tgt.hp -= d;
  G.events.push({ type: 'hit', x: tgt.x, z: tgt.z, side: tgt.side, aspect: src?.aspects?.[0], amt: d / tgt.max, id: tgt.id, from: src?.id });
  if (tgt.hp <= 0) kill(G, tgt, src);
  return d;
}

function kill(G, c, by) {
  const B = G.battle;
  c.alive = false; c.hp = 0;
  G.events.push({ type: c.side ? 'enemyDeath' : 'death', x: c.x, z: c.z, id: c.id, boss: !!c.boss });
  if (c.side === 1) {
    G.stats.kills++;
    G.gain(c.value * 3 * Math.pow(1.18, B.gw - 1), 'kill');
    if (c.boss) G.attention += 2;
    if (c.fuse) for (let i = 0; i < c.fuse; i++) {
      const def = STRESSOR.intrusion, a = G.rng() * 6.28;
      B.enemies.push({ id: B.nextId++, side: 1, def: def.id, x: c.x + Math.cos(a), z: c.z + Math.sin(a), hp: c.max / 12, max: c.max / 12, sal: c.sal * 0.5, lat: def.lat, reach: 1, speed: 1.6, opa: 0, cd: G.rng(), alive: true, stun: 0, mark: 0, value: 1, flip: 0 });
    }
  } else {
    if (c.store > 0) { for (const e of B.enemies) if (e.alive && dist(e, c) < 4) harm(G, c, e, c.store, { sure: true }); G.events.push({ type: 'cast', x: c.x, z: c.z, kind: 'store' }); }
    if (c.tr.release) for (const o of B.units) if (o.alive) o.hp = Math.min(o.max, o.hp + o.max * 0.5 * c.tr.release);
  }
}

const nearest = (c, list, maxD = Infinity, pred) => {
  let best = null, bd = maxD;
  for (const o of list) { if (!o.alive || (pred && !pred(o))) continue; const d = dist(c, o); if (d < bd) { bd = d; best = o; } }
  return best;
};

function cast(G, c, id, echo = false) {
  const B = G.battle, ab = ABILITIES[id], P = ab.power * (echo ? 0.5 : 1), es = B.enemies.filter((e) => e.alive);
  if (!es.length && !['heal', 'taunt'].includes(ab.kind)) return false;
  const tgt = nearest(c, es);
  G.events.push({ type: 'cast', x: c.x, z: c.z, kind: ab.kind, aspect: c.aspects[0], id: c.id, echo });
  if (echo) G.stats.echoes++;
  switch (ab.kind) {
    case 'invert': { const strong = es.slice().sort((a, b) => b.sal - a.sal)[0]; const v = nearest(strong, es, 99, (o) => o !== strong) || strong; harm(G, c, v, strong.sal * 6 * P + c.sal * P, { sure: true }); strong.stun = Math.max(strong.stun, 1.5); break; }
    case 'store': c.hard = 1.6; c.veil += c.max * 0.3 * P; break;
    case 'flurry': for (let i = 0; i < Math.round(P); i++) { const t = es[Math.floor(G.rng() * es.length)]; harm(G, c, t, c.sal * 0.9); } c.hp = Math.max(1, c.hp - c.max * 0.06); break;
    case 'retreat': { const a = Math.atan2(c.hz, c.hx) + Math.PI; c.x = Math.cos(a) * 8.5; c.z = Math.sin(a) * 8.5; c.hide = 1.2; for (let i = 0; i < 3; i++) harm(G, c, es[Math.floor(G.rng() * es.length)], c.sal * P * 0.7, { sure: true }); break; }
    case 'heal': { const stance = STANCES.find((x) => x.id === G.stance)?.mod || {}; const w = B.units.filter((o) => o.alive).sort((a, b) => a.hp / a.max - b.hp / b.max)[0]; if (w) w.hp = Math.min(w.max, w.hp + c.sal * P * 4 * (stance.heal || 1)); break; }
    case 'transfer': { const lost = c.max - c.hp; harm(G, c, tgt, lost * P + c.sal, { sure: true }); c.hp = Math.min(c.max, c.hp + lost * 0.4); break; }
    case 'blink': { const strong = es.slice().sort((a, b) => b.hp - a.hp)[0]; c.x = strong.x + 0.8; c.z = strong.z + 0.8; c.hide = 0.8; harm(G, c, strong, c.sal * P, { sure: true }); break; }
    case 'burst_affect': { let sum = 0; for (const e of es) if (dist(e, c) < 4.2) sum += harm(G, c, e, c.sal * P, { sure: true }); G.gain(sum * 0.02 * Math.pow(1.1, B.gw), 'transmute'); break; }
    case 'taunt': c.taunt = P; c.hard = 2.2; c.veil += c.max * 0.2; break;
    case 'equalize': { const low = Math.min(...es.map((e) => e.hp)); for (const e of es) if (!e.boss) e.hp = Math.max(low, e.hp * (1 - P)); else e.hp *= 1 - P * 0.3; break; }
  }
  return true;
}

export function stepBattle(G, dt) {
  const B = G.battle; if (!B) return;
  B.t += dt;
  const chargeMul = (B.arc.mod.chargeMul || 1) * (1 + av(B.tiers, 'cortical') / 100);
  // beats
  if (B.beat < BEATS_PER_WAVE) { B.beatT -= dt; if (B.beatT <= 0) { spawnBeat(G); B.beat++; B.beatT = BEAT_TIME * (G.overwhelm > 0.5 ? 0.7 : 1); } }
  const us = B.units, es = B.enemies;
  const calm = us.filter((u) => u.alive && u.tr.calm), tire = us.filter((u) => u.alive && u.tr.tire);
  // regulators
  for (const c of us) {
    if (!c.alive) continue;
    c.hide = Math.max(0, c.hide - dt); c.taunt = Math.max(0, c.taunt - dt); if (c.taunt <= 0 && c.ability === 'hold') c.hard = 1;
    const regen = (c.aspects.includes('vagal') || c.tr.fade ? av(B.tiers, 'vagal') / 100 : 0) + 0.02 * (c.tr.ease || 0);
    if (regen) c.hp = Math.min(c.max, c.hp + c.max * regen * dt);
    if (c.stun > 0) { c.stun -= dt; continue; }
    const tgt = nearest(c, es, 99, (e) => Math.hypot(e.x - c.hx, e.z - c.hz) < c.reach + 4.5);
    c.cd -= dt * (c.tr.rapture && c.hits < 4 * c.tr.rapture ? 2.5 : 1);
    if (tgt) {
      const d = dist(c, tgt);
      if (d > c.reach) { const s = Math.min(3.2 * dt, d - c.reach * 0.9); c.x += ((tgt.x - c.x) / d) * s; c.z += ((tgt.z - c.z) / d) * s; }
      else if (c.cd <= 0) {
        c.cd = c.lat;
        const strikes = 1 + (G.rng() * 100 < c.rec ? 1 : 0);
        for (let i = 0; i < strikes; i++) {
          c.streak = c.last === tgt.id ? c.streak + 1 : 0; c.last = tgt.id;
          let d0 = c.sal * (1 + c.lab * (G.rng() * 2 - 1));
          if (c.tr.ache) d0 *= 1 + 0.8 * c.tr.ache * (1 - c.hp / c.max);
          if (c.tr.gather) d0 *= 1 + 0.15 * c.tr.gather * Math.min(c.streak, 10);
          harm(G, c, tgt, d0, { });
          if (c.tr.glad) G.gain(0.4 * c.tr.glad * Math.pow(1.18, B.gw - 1), 'glad');
          c.hits++;
        }
        c.charge += 14 * chargeMul;
        G.events.push({ type: 'strike', x: c.x, z: c.z, tx: tgt.x, tz: tgt.z, aspect: c.aspects[0], id: c.id });
      }
    } else { const d = Math.hypot(c.hx - c.x, c.hz - c.z); if (d > 0.05) { const s = Math.min(2.5 * dt, d); c.x += ((c.hx - c.x) / d) * s; c.z += ((c.hz - c.z) / d) * s; } }
    if (c.charge >= 100) { if (cast(G, c, c.ability)) { c.charge = 0; if (c.echo) cast(G, c, c.echo, true); } else c.charge = 100; }
  }
  // stressors
  for (const e of es) {
    if (!e.alive) continue;
    e.mark = Math.max(0, e.mark - dt);
    if (e.stun > 0) { e.stun -= dt; continue; }
    const slow = calm.some((u) => dist(u, e) < 4) ? 1.35 : 1, weak = tire.some((u) => dist(u, e) < 4) ? 0.7 : 1;
    const taunter = nearest(e, us, 6, (u) => u.taunt > 0);
    const tgt = taunter || nearest(e, us, e.reach + 2.2, (u) => u.hide <= 0);
    e.cd -= dt / slow;
    const dCore = Math.hypot(e.x, e.z);
    if (tgt) {
      const d = dist(e, tgt);
      if (d > e.reach) { const s = e.speed * dt; e.x += ((tgt.x - e.x) / d) * s; e.z += ((tgt.z - e.z) / d) * s; }
      else if (e.cd <= 0) { e.cd = e.lat; harm(G, e, tgt, e.sal * weak); }
    } else if (dCore > ARENA.core) { const s = e.speed * dt; e.x -= (e.x / dCore) * s; e.z -= (e.z / dCore) * s; }
    else if (e.cd <= 0) { e.cd = e.lat; G.composure -= e.sal * weak * 0.5; G.events.push({ type: 'coreHit', amt: e.sal / G.composureMax }); }
  }
  // soft separation so crowds read as crowds
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
    const a = es[i], b = es[j]; if (!a.alive || !b.alive) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 0.01;
    if (d < 0.7) { const p = (0.7 - d) * 0.5; a.x -= (dx / d) * p; a.z -= (dz / d) * p; b.x += (dx / d) * p; b.z += (dz / d) * p; }
  }
  B.enemies = es.filter((e) => e.alive || (e.deadT = (e.deadT || 0) + dt) < 0.01);
  if (G.composure <= 0) return 'lost';
  if (B.beat >= BEATS_PER_WAVE && !B.enemies.some((e) => e.alive)) return 'won';
  return null;
}

export const familyOfUnit = (u) => FAMILY[leaves(u.g)[0].f];
