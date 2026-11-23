---
name: nonmind-game-structure
description: Use when changing or reasoning about NON-MIND gameplay and data. That includes the 18-stage loop and its unlock gates, waves, beats and the rhetorical arc, families, aspects, stats and traits, the 12-link genetic ladder, the genome operations (integrate, subtract, split, repurpose, fuse), the economy (affect, attention, insight, habits, upgrades, spells, verbs, moods, stances, seasons, mirrors), complexity, capacity, overwhelm, and the non-mind reset. Also use when adding a family, upgrade, stage gate, verb or stressor, or when balancing. Files are src/game/data.js, genome.js, battle.js, game.js, store.js and index.js.
---

# NON-MIND game structure

**NON-MIND** is a very complex, abstract but detailed 3D game of seating and holding that plays itself, with auto-clicker and incremental layers, built with web technologies only. Its characters are named after emotional and affective regulation terms. The whole design is about **complexity**:
- You start (and can reset to) a *simple* state.
- You then get lost in incremental designs (splits, merges, repurposing, subtraction) until the complexity in 3D overwhelms you.
- You let go ("non-mind"), and come back simple and deeper.

Unit stats are quirky and weird, and the explanations are more confusing than helpful, **but every number really works**.

The design remixes *systems* (never names, art or text) from four kinds of game:
- **Card-table occultism with timed verbs**: verbs that take a card, decaying moods (Dread/Contentment/Fascination), seasons that demand something, and the cryptic, overwhelmed edge.
- **Drafting in games of seating and holding**: shop odds by level, tiers, merge-by-copies fusion (here, 2 of the same genome at the same link), aspect alliances at thresholds 2/4/6, interest, and streaks.
- **Idle/incremental layering**: habits with ×1.15 cost growth, odd upgrades scaling on run state, a prestige currency (`G.mu` in code, shown to the player as **residue**), and mirrors (deep multipliers).
- **Slow-season pressure** with named fields and witnesses.

Owner: "Don't forget the card-table occultism edge, the incremental/overwhelmed fact, stages, progression, upgrades."

The game lives in `src/game/`. It is pure JS with no DOM, and it is deterministic given the seed (`mulberry` in `game.js`). `index.js` is the only API the UI, gfx, audio and tests import. UI code calls `act(name, ...args)` from `store.js` and never mutates `G`.

## 1. Structural skeleton (structure only, never content)

The skeleton is a formal ten-fold structure. Only its shape is used:
- **One centre**: the core (composure), which you click to `attend`.
- **10 directions**: `DIRECTIONS = 10` gates on a disc (`gatePos`). Seats are in 3 rings × 10 directions (`ARENA.rings [3.2, 5.4, 7.6]`), with odd rings offset by half a step.
- **10 leaders**: the 10 families, one per gate (`dir 0..9`). Each fills a **5-slot tuple** (direction, name, home field, witness, retinue):
  - direction is `dir`
  - name is a regulation noun ending in -tion/-al/-ance/-ity
  - home field is `field`, which always reads `"Field of <X> Weather"`
  - witness is `witness`, which always reads `"<Adj> Witness"`
  - retinue is its `aspects`
  - The names share morphemes. Keep the pattern when adding one.
- **10 speakers × 10 stanzas × 4 lines**: a cycle is `WAVES_PER_CYCLE = 10` waves × `BEATS_PER_WAVE = 10` beats (one beat every `BEAT_TIME = 2.4` s). Each beat spawns from `gate0 = (beat*3 + wave + cycle) % 10`.
- **Rhetorical arc**: `WAVE_ARC[(wave-1) % 10]` gives each wave a modifier that follows the ten moves:

  | # | move | id | mod |
  |---|---|---|---|
  | 1 | negation | negation | opa 35 |
  | 2 | beyond words | ineffable | charge ×0.5 |
  | 3 | analogy, "Just as" | analogy | ×2 count, ×0.55 tol |
  | 4 | one/many | onemany | fuse: one shame that bursts into N |
  | 5 | counting | counting | jitter |
  | 6 | placeless | placeless | all gates |
  | 7 | same/different | same | mirrorForms, sal ×1.3 |
  | 8 | observer-made | observer | count from clicks |
  | 9 | self-cancelling | cancel | noAspects |
  | 10 | return to action | return | great one, oneShot 3% |

- **Simultaneity/mirroring**: the `mirror` purchase says "The same assembly, in every direction, under the same names". Each mirror gives ×2 affect, +2 unit cap, a third ring, +70 complexity and +20% stressor tolerance (`mirrorCost(G)` in game.js).
- **"Small enters great"**: the stage 15 hint. Small (a leaf) enters great (a hybrid) through integrate; great enters small through split.
- **Text templates** (see the nonmind-voice skill): "X is not A; nor is it B", "X has no P, yet fills every P", "Just as …, so …".

## 2. The 18 stages (exact order) and what each unlocks

`STAGES[i] = { id, unlock, hint, need(G) }`. `step()` advances while `STAGES[stage+1].need(G)` holds. `unlocked(G, what)` is true when the stage that unlocks `what` is at or before `G.stage`. Index 10 and index 12 are both `evoke`. That repetition is intended.

| # | id | unlock | need to reach it | gate in code |
|---|---|---|---|---|
| 0 | appear | attend | (start) | core click |
| 1 | explore | shop | clicks ≥ 5 | `buy`, TopBar attention |
| 2 | grow | habits | wave ≥ 2 or settled ≥ 6 | `buyHabit`; upgrades from stage 2 |
| 3 | combine | integrate | links ≥ 1 | `integrate` (free until insight exists) |
| 4 | repurpose | repurpose | integrations ≥ 1 | `repurpose` |
| 5 | increase | insight | habitsOwned ≥ 8 | insight regen, op costs, spells |
| 6 | regroup | split | wave ≥ 5 | `split` (10 insight) |
| 7 | expand | ring2 | level ≥ 5 | second seat ring |
| 8 | ingest | subtract | splits ≥ 1 | `subtract` (35 insight) |
| 9 | support | attendants | subtractions ≥ 1 | auto-clickers, 300·2.2^n |
| 10 | evoke | verbs | cycle ≥ 1 or wave ≥ 9 | dream, ruminate, rest, confide |
| 11 | interchange | exchange | verbsDone ≥ 2 | 4 currency exchange routes |
| 12 | evoke | echo | exchanges ≥ 3 | second-heaviest family's ability casts at half power |
| 13 | inhabit | stance | echoes ≥ 20 | toward / away / against |
| 14 | sustain | seasons | stance chosen | every 60 s the season takes 3 attention, or adds a Dread |
| 15 | penetrate | mirror | seasons ≥ 5 | mirror, `mirrorCost` (×25 per mirror) |
| 16 | embrace | wildcard | mirrors ≥ 1 | +1 count to every aspect (`aspectTiers`) |
| 17 | overwhelm | nonmind | overwhelm ≥ 1 | the reset |

Each stage also:
- morphs the palette (`STAGE_PALETTES[i]`)
- adds a core element (`coreMaterial`)
- raises capacity (+30% per stage)
- emits a `stage` event, which plays the `unlock` SFX and flashes

## 3. Units: genome, families, aspects, stats, traits

- **Genome** (`genome.js`): a binary tree. Leaves are `leaf(family, pole)`, with pole -1 devalued, 0 whole or +1 idealised. Nodes are `node(op, a, b, k)`, with op `blend|carve|mix`. `key(g)` is the identity string; fusion and material caching use it.
- **Weights**:
  - A blend gives children 0.5/0.5 ×1.15.
  - A carve gives the base ×1.25 and the carved-in part 0.35 ×1.15.
  - The heaviest leaf is the "head". It drives the name (`nameOf`: modifier adjectives + `Hollowed ` for carve + pole + head name), the `ability`, and the `echo` (second-heaviest leaf).
- **Stats** (deliberately odd names):

  | stat | means |
  |---|---|
  | tol | tolerance, i.e. HP |
  | sal | salience, i.e. how much it eases |
  | lat | latency, i.e. seconds between answers |
  | reach | range |
  | opa | opacity, i.e. % chance to be missed |
  | lab | lability, i.e. ease variance |
  | rec | recursion, i.e. % chance to answer twice |

  How they combine:
  - `baseStats` is the weighted blend of the leaves' stats.
  - Poles skew them: idealised gives tol ×0.6, sal ×1.7, lat ×0.85; devalued gives tol ×1.5, sal ×0.7; and any pole adds lab +0.25.
  - Synergy is `1 + 0.12·(leaves-1)`.
  - `unitStats` then multiplies by `LINKS[link-1].mult`, stance, aspect tiers, `crowd` (`1 + C/60`), endings, and a momentum term from lifetime earnings and residue.
- **Aspects** (8): vagal, limbic, cortical, somatic, shadow, relational, void, mythic.
  - A unit has its top 2 by weighted vote, or 3 if it has 4 or more leaves.
  - A tier activates at 2/4/6 *distinct head families* seated (`aspectTiers`).
  - A `fade` trait counts as every aspect.
- **Families** (10, tiers 1-5): each has `aspects, field, witness, stats, ability, form, colors, text`. `ABILITIES` fire at charge 100. Charge comes from +14 per answer and from weight taken. The ability kinds are invert, store, flurry, retreat, heal, transfer, blink, burst_affect, taunt and equalize.
- **Traits** (genes): one per link, stored in `u.traits`, max 10. They are inherited through `inheritTraits` (a union where a duplicate can double up with 35% chance) and counted as copies during a wave (`tr`), so stacking genes scales them.
- **Stressors**: intrusion, deadline, criticism, ambiguity, shame, and the abandonment great one on wave 10. They are scaled by `1.24^(gw-1) · (1 + 2·overwhelm) · (1 + 0.5·mirrors)`.

## 4. The 12-link ladder ("VERY genetic, be smart, evolve")

The 12 links are the upgrade track, from `LINKS` in `data.js`. Names are English only (in data and in every player-visible string):

| link | name | stat mult | trait |
|---|---|---|---|
| 1 | Unsatisfactoriness | ×1 | ache |
| 2 | Confidence | ×1.7 | trust |
| 3 | Gladness | ×2.8 | glad |
| 4 | Rapture | ×4.5 | rapture |
| 5 | Tranquillity | ×7 | calm |
| 6 | Ease | ×11 | ease |
| 7 | Collectedness | ×17 | gather |
| 8 | Seeing As It Is | ×26 | see |
| 9 | Disenchantment | ×40 | tire |
| 10 | Dispassion | ×62 | fade |
| 11 | Release | ×95 | release |
| 12 | Knowing The Ending | ×150 | end |

Mechanics in `game.js`:
- **`fuse`**: whenever a unit is added, any other non-busy unit with the **same genome key and the same link** fuses with it. From link 4 up (`FUSE_NEAR`) it also fuses with a copy one link away (that neighbour must be link 3 or more), so the climb turns from doubling to Fibonacci. The kept unit is the seated one. It gets `max(link)+1`, inherited traits, the new link's trait, a 60% mutation roll. Fusion chains automatically.
- **Link 12** removes the unit and adds `G.endings++`. Each ending is a permanent +10% affect and +10% salience that survives the reset.
- Visually, the link grade runs from muddy and knotted to saturated to pale and luminous, and halos appear (see nonmind-shaders).
- Evolution stays genetic because hybrids are trees, traits are heritable genes, split recovers parents, dream mutates toward related families, and pruning leaves `ghosts`. Any new mechanic should act on the genome or the traits, not on a flat "level".

## 4b. Advisor (`advisor.js`)

Pure functions over `G` for idle hints: `suggestions(G)` lists every valid, TRUE nudge (each has a `target` the HUD anchors to, an oblique `text` and a `plain` line); `nextSuggestion(G, memory, now)` rotates them with a 90 s cooldown. Constants `IDLE_BEFORE_SUGGESTING` (25 s), `SUGGESTION_LIFETIME` (15 s), `SUGGESTION_GAP` (6 s). The HUD (`hud/Nudge.jsx`) draws the arrow; the `?` button and the keys `?` / `H` ask for the next hint at once. A new rule must only fire when the thing can be done right now.

## 5. Operations

| op | action | cost | genome effect | link | traits |
|---|---|---|---|---|---|
| integrate | `integrate(a,b)` | 20 insight (free before insight unlocks) | `node('blend', a, b, k)` | max(a,b) | inherited |
| subtract | `subtract(a,b)` | 35 insight | `node('carve', a, b, k)`, so b is carved out of a | a.link | a's + one of b's |
| split | `split(id)` | 10 insight | a node splits into its 2 children, each returning at the link its parent brought to the integrate (`u.parentLinks`; no link is minted by joining then parting). A whole leaf at link > 1 splits into its +1 and -1 poles, one link lower | per parent | halves |
| repurpose | `repurpose(id)` | none | the unit becomes `max(1, round(link·(1+leaves)/2))` habits; the habit is picked by worth: index `min(9, tier-1 + floor((link-1)/3))` | n/a | n/a |
| fuse | automatic | none | same key and link | +1 | inherited + new |

Details:
- `combine` → `prune` caps the tree at `MAX_LEAVES = 6`. Dropped leaves become `ghosts`, which add complexity.
- Every op emits an event (`integrate`, `subtract`, `split`, `repurpose`, `link`), which drives the SFX and the 3D pop/flash. A new op must emit one too.
- The UI flow for two-unit ops is `setPending(kind)` with the first unit selected, then `choose(otherId)` (`store.js`).

## 6. Economy layers

- **Affect** (main incremental currency):
  - Sources: clicks (`clickValue`), habits (`habitYield · affectMul` per second), settled stressors (`value·3·1.18^(gw-1)`), held waves (`20·1.35^(gw-1)`), and some traits and abilities.
  - `affectMul` multiplies residue (`1 + 0.04·mu`), complexity (`1 + C/25`, so **complexity pays**), endings, `2^mirrors`, mythic tier, upgrades, fascination, and the away stance.
- **Attention** (gold of games of seating and holding):
  - It buys units (`TIER_COST [1..5]`), rerolls (2) and XP (5 for 4 XP).
  - A held wave pays 7 + interest (1 per 10 held, capped at 5, or 10 with `thrift`) + a streak bonus (`min(3, floor(streak/3))`). A wave not held pays +3 and refills composure. Settling a great one pays +2.
  - The shop leans toward the family you are climbing: from stage 3, each slot has a 30% chance (`SHOP_FOCUS`) to show the highest-link leaf unit's family.
  - **Mercy**: in prep, with the shop unlocked, nothing usable held and too little attention for the cheapest slot or a reroll, a tier-1 family appears in slot 0 and attention is lifted to 1. A mind is never left with nothing.
- **Insight**: capped at 100. It regenerates at `1 + 0.15·level` per second and pays for ops and spells (`exhale`, `label`, `recollect`).
- **Level/XP**: `XP_TO_LEVEL = [2, 3, 6, 10, 16, 26, 40, 60, 90]`, max 10; a held wave gives 2 xp, one not held 1. Unit cap is `min(30, level + 1 + 2·mirrors)`. Shop odds by level come from `SHOP_ODDS`.
- **Habits**: 10 of them (Breath to Identity), with cost `base·1.15^owned`.
- **Upgrades**: odd scalers gated by stage: noticing, counting_breaths, old_wound, long_view, crowd, thrift, second_arrow, lending.
- **Attendants**: auto-clickers at 0.5× click value and 0.25 clicks per second each.
- **Verbs** (timed slots that hold a unit, aspect-gated):
  - dream: the unit is replaced by a related family
  - ruminate: +45 insight and a Dread (30% Fascination instead)
  - rest: removes a Dread and restores full composure
  - confide: a Contentment
- **Moods** decay over their `life`:
  - Dread: 3 of them give ×1.5 stressors.
  - Contentment: cancels a Dread.
  - Fascination: ×1.5 affect.
- **Stances**:
  - toward: heal ×2, reach ×0.8
  - away: opa +20, reach ×1.3, affect ×0.8
  - against: sal ×1.6, tol ×0.8
- **Seasons**: every 60 s, from stage 14.
- **Exchange**: fixed routes `affect>attention`, `attention>insight`, `insight>attention`, `attention>affect`.

## 7. Complexity, capacity, overwhelm, reset

Each `step`:
```
C = Σ complexityOf(u) + √habitsOwned·1.2 + upgrades·1.5 + moods + mirrors·70 + attendants·0.6 + (stance ? 3 : 0)
    + 2.5·log10(1 + earned) + 1.5·(cycle·10 + wave)
complexityOf(u) = (leaves + depth·0.5 + ghosts·0.5)·(1 + (link-1)·0.35) + traits·0.25
capacity = 40·(1 + 0.3·stage)          (residue no longer widens it)
overwhelm = clamp((C - capacity) / (capacity·0.12), 0, 1)
```
- At overwhelm 1, composure drains 2% per second. Overwhelm also scales stressor tolerance by `1 + 1.2·overwhelm` (up to ×2.2) and speeds beats by ×0.7 above 0.5.
- Stressor tolerance per global wave `gw`: `3.4 · 1.1^min(gw-1,18) · 1.04^clamp(gw-19,0,10) · 1.015^max(0,gw-29) · (1+1.2·overwhelm) · (1+0.2·mirrors) · 0.88^habituation` (habituation: +1 per wave not held, max 12, reset by a held wave). Salience `1.04^(gw-1)`.
- Wave 10 of a cycle (arc `return`): each regulator answer has a 3% chance to deal the target's whole remaining tolerance (the one-answer rule).
- `mood.complexity = C/capacity` (eased) is what makes the visuals and the music richer.
- **nonMind** (the reset): `muGain = floor((peak/8)^0.8 · (1 + stage/17) · (overwhelm ≥ 1 ? 2 : 1) · (1 + 0.15·depth))`, shown as **residue**. A new game keeps `mu, endings, depth+1, bestStage, totalT`; it starts with `3 + min(20, floor(√mu))` attention. Everything else becomes simple again. It emits a `reset` event, which triggers the audio collapse and a flash of 1.
- `actions.nonMind` refuses below stage 1 (returns the same game); the UI gate is stricter.

## 8. How to add things (each one is a mediator-lane edit in src/game unless you own it)

**A family** (there are exactly 10 directions, so a new one *replaces* one, or becomes a stressor or a mutation; do not make it an 11th gate):
```js
{ id: 'mentalization', name: 'Mentalization', dir: 4, tier: 3, aspects: ['relational', 'cortical'], field: 'Field of Window Weather', witness: 'Guessing Witness',
  stats: { tol: 610, sal: 58, lat: 1.15, reach: 3.2, opa: 8, lab: 0.35, rec: 5 }, ability: 'mend', form: 'rings', colors: ['rose', 'ultra'],
  text: 'It is sure what you meant. It is often right, which is worse.' },
```
After that you must also update:
- `FAMILY_PALETTES` and `ADJ` (genome.js)
- `FORMS` (if it has a new form)
- tests in `tests/game/`

**An upgrade**: add `{ id, name, cost, text, stage }` to `UPGRADES`, and implement the effect as a **pure function of the run** where the stat is computed (`affectMul`, `unitStats`, `habitYield`, `endWave`), read as `G.upgrades.id`. Make it odd: it should scale on something unexpected (missing composure, time in run, complexity). Its text should be cryptic but true.

**A stage gate**: you change the `need` of an existing stage. The 18 ids and their order are fixed. `need` must be reachable by `defaultBot` within the progression tests, and it must depend on the *previous stage's unlock* being used. That is the rule that teaches each system in turn.

**A verb**: add it to `VERBS` (`time`, `needs` aspect or null, `text`, `stage: 10`). Implement the result in `finishVerb`, which should produce or consume moods, insight or genome change. It must emit `verbDone` (already generic). Busy units leave their seat; `deserialize` frees orphans.

**A stressor or arc mod**: add it to `STRESSORS` with `form` (also add it to `FORMS` in sculpt.js) and `color` (a token name). New wave mods go in `WAVE_ARC[].mod` and are read in `spawnBeat`/`stepBattle`. Keep 10 arc entries.

## 9. Invariants every change must keep

1. Determinism: all randomness goes through `G.rng`, with no `Math.random` in `src/game`. Same seed and same inputs give the same run.
2. `src/game` stays pure: no DOM, three or audio imports. Effects leave the engine only as `G.events` (`{type, ...}`, with x/z for spatial ones).
3. 18 stages in this exact order, 10 directions, 10×10 waves and beats, 12 links, 8 aspects at thresholds 2/4/6.
4. Every number in a tooltip is real. Confusing wording is allowed; lying is not.
5. `step(G, dt)` clamps dt to 0.25 or less. Event queue at most 400. Log at most 40.
6. Serialize round-trips (`serialize`/`deserialize`). New fields in `G` must be JSON-safe or rebuilt in `createGame`.
7. A system's UI appears only when `unlocked()` says so.
8. Complexity must rise with every incremental verb the player uses. That is the core loop: simple, then lost, then overwhelmed, then reset.
9. Run `npx vitest run tests/game` and `node tests/game/balance.mjs` (see nonmind-verify) before handing back.
