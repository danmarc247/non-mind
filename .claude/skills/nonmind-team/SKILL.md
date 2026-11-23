---
name: nonmind-team
description: Use when planning, delegating, briefing, reporting or coordinating work on NON-MIND (/home/user/non-mind) with more than one agent or lane; when choosing which model (Fable, Opus, Sonnet, Haiku) gets a task; when writing a lane brief, a hand-back report, or a docs/team-log.md entry; when deciding commit/push rhythm or when to re-research the reference game wikis. Not for single-file edits done alone.
---

# NON-MIND team protocol

Source of truth: `docs/TEAM.md` (org, lanes, contracts) and `docs/team-log.md` (cross-lane messages). Read both before briefing anyone. This skill is the working procedure on top of them.

## Org

- **Fable** is the genius boss and **mediator**. It owns architecture, contracts, integration, playtesting, and the hardest code itself (engine, genome-to-shader pipeline, arena). It is the only agent that runs `npm install`, edits `package.json`, `vite.config.js`, `vitest.config.js`, and the only one that touches git.
- **Opus**: complex coding lanes (shaders, audio engine, HUD, UI kit).
- **Sonnet**: smaller supportive tasks (tests, balance reports, content tables, mechanical ports).
- **Haiku**: simple mini things (palettes, single sound effects, small data) and cheap checking agents (wiki re-reads).

Agents can and should inform each other. The boss is the mediator, and that must be VISIBLE: every cross-lane need becomes a line in `docs/team-log.md`, and the mediator's routing is a line too. No agent edits another lane, no agent messages another lane in private.

## Working principles

1. **Parallel**: independent lanes launch in one batch, never serially. Ten lanes with disjoint file ownership is normal.
2. **Token-efficient**: brief tightly (see template), give file pointers instead of pasting code, ask for reports under ~100 words, never have two agents read the same big file "to be safe".
3. **Commit regularly and push**: mediator commits after every integrated lane, not at the end of the day (see rhythm below).
4. **Test the deployment early**: the first push gets a GitHub Pages check (see `nonmind-verify`), not the last. Base is `./` and hosting is under a sub-path, so absolute URLs break only in production.
5. **Reuse skills**: before writing a brief, check `.claude/skills/`. Point the agent at `nonmind-voice`, `nonmind-verify`, `nonmind-stack` by name instead of restating them.
6. **Remix, never copy**: reference games supply systems only. No names, art or text.

## Model choice table

| Task | Model | Why |
|---|---|---|
| Game state shape, `actions`, `step`, battle engine, genome to shader pipeline | Fable (itself) | contract-defining, everything depends on it |
| Painter sky/post-process shaders (GLSL + lygia, ShaderMaterial) | Opus | multi-file, visual iteration |
| Web Audio engine, adaptive music, offline-render harness | Opus | stateful, measured |
| HUD (`src/ui/hud/**`), UI kit | Opus | many components, motion + layout |
| Vitest suites, balance probe, `simulate` bot reports | Sonnet | mechanical, report-heavy |
| Koan pools, stage hints, unit text tables (with `nonmind-voice` loaded) | Sonnet | volume, rule-bound |
| Port a React Bits component into `src/ui/bits/backgrounds/` | Sonnet | mechanical port |
| 14 colour palettes, one sound effect (a blip, a bell), a small JSON table | Haiku | tiny, checkable |
| "Does the Underlords wiki say X about economy?" re-read | Haiku | cheap, factual |
| Deciding whether a stat needs a new contract field | Fable | arbitration |

Rule of thumb: if wrong output would silently break other lanes, Fable or Opus. If a failing test or a glance catches it, Sonnet or Haiku.

## Lanes

A lane = a glob of files one agent may edit, plus its own gallery page and dev port. Current lanes are in `docs/TEAM.md`. Lane globs must not overlap. Shared contracts (`src/gfx/mood.js`, `src/game/index.js`, `src/index.css`) change only through the mediator, announced in the log.

Ports: each lane gets its own (e.g. sky 5181, post 5182, audio 5183, hud 5184, type 5185). Cache: `NM_CACHE_DIR=/tmp/nm-cache-<lane>`.

## Briefing template

```
LANE: <name>   MODEL: <model>   PORT: <n>
GOAL: <one or two sentences, observable outcome>
YOU MAY EDIT ONLY: <globs>
DO NOT: run git or npm, edit config, edit other lanes. Need something? Add a line
  to docs/team-log.md: `[tag] <lane> -> <lane|mediator>: <need>`.
CONTRACTS: <files + exact exports you read, never change>
SKILLS: nonmind-verify (always), nonmind-voice (if any player-visible text), nonmind-stack (if a library)
GALLERY: <html at root + entry jsx>; <what must be visible in it>
VERIFY: <the lane's proof: screenshots / vitest / offline render, zero console errors>
REPORT (under 100 words): what exists, exact exports, what you need from other lanes, files list.
```

### Worked example brief

```
LANE: Sky   MODEL: Opus   PORT: 5181
GOAL: PainterSky: a full-screen painterly sky that reads `mood` (hue, tension,
  overwhelm, time) every frame. At overwhelm 1 the sky shreds into noise bands;
  at 0 it is a slow wash. No React state per frame.
YOU MAY EDIT ONLY: src/gfx/PainterSky.jsx, src/gfx/glsl/sky.*, src/gfx/galleries/sky.jsx, sky-gallery.html
DO NOT: run git/npm, edit vite.config.js or src/gfx/mood.js. If you need a new mood
  field, log `[sky] sky -> mediator: need mood.horizon (0..1)` and keep going with a local fallback.
CONTRACTS: src/gfx/mood.js (mutable object; read only inside useFrame).
SKILLS: nonmind-verify, nonmind-stack (lygia include path, ShaderMaterial rules)
GALLERY: sky-gallery.html -> src/gfx/galleries/sky.jsx. Sliders for each mood field;
  three test spheres in front so depth/overlap is visible.
VERIFY: dev server on 5181 with NM_CACHE_DIR=/tmp/nm-cache-sky; Playwright shots at
  overwhelm 0, 0.5, 1; open the PNGs and describe them; zero console errors; window.__frames > 60.
REPORT: <100 words: exports, mood fields consumed, requests, files.
```

## Hand-back format (what an agent returns)

```
DONE: <lane>. Files: <abs paths>.
EXPORTS: <name(args) - one line each>
PROVED: <screenshots looked at: what they show; tests: N passed; console errors: 0>
NEEDS: <lane -> need> (also appended to team-log)
RISKS: <one line or none>
```

The mediator verifies a claim by opening one screenshot or rerunning one command, not by re-reading all code.

## Team-log protocol

- File: `docs/team-log.md`. Format `[tag] from -> to: message`, newest last, append only.
- Specialists append only their own cross-lane requests and findings. The mediator appends routing decisions, contract changes (`[tN] mediator -> all: ...`) and answers.
- A finding must be reproducible in one line (see the existing `[tests]` entry: file, line, repro call). Vague "feels off" lines are rejected.
- Contract change = log line first, code second.
- A log line is the ONLY inter-lane channel. Do not paste another lane's work into your brief unless the mediator routed it.

## Wiki re-reads (inspiration)

When new inspiration is needed (Dota Underlords, Realm Grinder, Cultist Simulator fandom wikis), spawn a cheap Haiku checker. Plain page fetches are blocked; use the MediaWiki API with a browser User-Agent:

```bash
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
curl -sA "$UA" 'https://underlords.fandom.com/api.php?action=parse&page=Gold&prop=wikitext&format=json' | head -c 4000
```

Wiki hosts: underlords / realmgrinder / cultistsimulator `.fandom.com` (verify the subdomain once; a 404 JSON means wrong host). Instruct the checker: return a digest of SYSTEMS (numbers, loops, rules), no names, no flavour text, no quotes. The digest goes in the report, not in the repo.

## Commit / push rhythm (mediator only)

1. Lane hands back, mediator checks one proof, runs `npx vitest run` if `src/game/**` changed.
2. `git add` that lane's paths only; one commit per lane, message `<lane>: <what>` plus the attribution lines from the session reminder.
3. `git push` after every 1-3 lanes. Never accumulate more than a morning of unpushed work.
4. After the FIRST push, and after any change to `vite.config.js`, `index.html` or asset paths, run the deploy check from `nonmind-verify`.
5. Specialists never run git; if a specialist reports "committed", something is wrong.

## Checklist before launching a batch

- [ ] Lanes disjoint, each with gallery + port + cache dir
- [ ] Every brief names its verification and report length
- [ ] Skills referenced by name
- [ ] Contracts the lanes read are already committed
- [ ] Haiku used for anything trivially checkable
