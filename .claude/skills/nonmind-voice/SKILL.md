---
name: nonmind-voice
description: Use whenever writing or editing any player-visible text in NON-MIND - unit and family descriptions, stat or trait explanations, ability text, stage hints, wave and koan lines, log/event lines, tooltips, titles, error toasts - or when naming a unit, system or stat. Also for reviewing text written by another agent. Encodes the cryptic-but-true voice and the sentence templates.
---

# NON-MIND voice

Reference files: `src/game/data.js` (STAGES hints, LINKS, TRAITS, ASPECTS, FAMILIES, ABILITIES) and `src/game/content/koans.js`. Read 20 lines of each before writing, to calibrate.

## The rule

Text is **cryptic and oblique, more confusing than helpful, but it all works.** The player should not be able to read the number off the sentence, yet after playing, every sentence turns out to have been exactly true. Therefore:

1. **Every sentence must be TRUE to the mechanic.** Before writing, state the mechanic in numbers (e.g. "heals the lowest-tolerance ally for 2.5x salience"). The line may hide it, but never contradict, exaggerate or invent it. If the mechanic changes, the text changes in the same commit.
2. **Oblique, not wrong.** Use an image that is literally accurate (a lid keeps something in and releases it later = Lid stores harm and returns it).
3. **Never jokey.** No puns, no winks, no "oops", no exclamation marks, no emoji, no second-person nagging. Dry understatement is allowed; punchlines are not. (Existing family texts such as "a career" are deadpan, not jokes; stay at that level or below.)
4. **Short.** Hints and tooltips: under 12 words. Koans: 10-18 words. Family text: one or two sentences.
5. **Plain words, concrete nouns.** Lamp, tide, frost, door, knot, ledge. No jargon in flavour lines, no stat abbreviations.
6. **Never copy text from any game or scripture.** Reference games and traditions supply STRUCTURE only. Do not paste, lightly reword, or "translate" a line you remember. Write from the mechanic outward, using the templates below.

## Naming

- **Units** are named after emotional/affective regulation terms: Reappraisal, Suppression, Rumination, Avoidance, Attunement, Projection, Dissociation, Sublimation, Containment, Equanimity. Pattern: a `-tion/-al/-ance/-ment` noun. New units follow it (Acceptance, Distraction, Habituation, Mentalization, Self-soothing, Catharsis).
- Home fields: `Field of <Material> Weather`. Witnesses: `<Adjective> Witness`.
- Stressors are plain nouns of pressure (Intrusion, Deadline, Shame). Stats keep the established words: tolerance, salience, latency, reach, opacity, lability, recursion.
- Aspects: one clinical-ish adjective (Vagal, Limbic, Cortical, Somatic, Shadow, Relational, Void, Mythic).
- Links keep their Pali name plus an English gloss in data; the player-facing `text` line is oblique English.

## Sentence templates (structure only)

Fill with your own images. Each template has a slot for a TRUE mechanic fact.

| Template | Use for |
|---|---|
| `X is not A; nor is it B.` | negations that point at a mechanic by exclusion |
| `X has no P, yet fills every P.` | passives, auras, always-on effects |
| `Just as [natural image], so [inner event].` | cause and effect, ability triggers |
| `Although [long effort], without [core] it is not called [effort].` | requirements, thresholds, gates |
| `If one [small act], one certainly [large result].` | scaling, compounding, thresholds |
| `One sees [N], equal in number to one's [faculty].` | counts that equal a real variable |

For the last template, N must be a number the game could actually show (units seated, clicks, links). If N is decorative, the line is false: do not use it in mechanical text, only in pure ambient koans.

## Good / bad pairs

Mechanic first, then BAD (what to avoid) and GOOD.

### Unit text (family `text`)
1. Reappraisal (inverts a target's strike): BAD "Haha, it flips the script!" GOOD "It turns the thing over until the thing has another side."
2. Suppression (stores damage, returns it on death): BAD "A tough guy who holds it all in." GOOD "Nothing is happening. It will keep not happening, louder."
3. Rumination (5 fast strikes, takes recoil): BAD "Overthinks everything LOL." GOOD "Again. And the again of again."
4. Avoidance (leaps to far rim): BAD "Runs away from problems." GOOD "It is excellent at being elsewhere."
5. Containment (taunt + harden): BAD "The tank. Soaks hits." GOOD "It does not fix. It is a place where unfixed things may be."
6. NEW Habituation (stressors lose salience the longer they stay): BAD "Gets used to things." GOOD "The same sound, a little less, each time it comes."
7. NEW Catharsis (spends its tolerance to damage all near): BAD "Lets it all out!" GOOD "It empties itself and the room is not emptier."

### Stat and trait explanations
8. Tolerance: BAD "HP. How much damage before death." GOOD "How much can arrive before it stops being able to be here."
9. Latency: BAD "Attack speed (lower is faster)." GOOD "The pause between a thing and its answer."
10. Opacity: BAD "Dodge chance 30%." GOOD "The share of strikes that find only the place it was."
11. Recursion: BAD "Chance to attack twice." GOOD "Sometimes it answers twice, once to itself."
12. Trait `ease` (heals each second): BAD "Regenerates, nice." GOOD "Mends itself continuously."
13. Trait `see` (ignores opacity and veils): BAD "True sight!" GOOD "It stops adding. Nothing hides from it."
14. Aspect Vagal (members heal 2/5/10 per second): BAD "Healing vibes." GOOD "Members mend 5 of tolerance each second." (numbers allowed where exact)
15. Link 5, tranquillity: BAD "Level five: very calm." GOOD "The shaking stops shaking."

### Stage hints (under 12 words, tell WHICH system without naming it)
16. Unlocks shop after 5 clicks: BAD "Click 5 times to open the shop!" GOOD "What arrives can be seated."
17. Unlocks habits: BAD "Buy upgrades to grow." GOOD "What repeats, remains."
18. Unlocks integrate (needs a link): BAD "Merge two units." GOOD "Two that agree are not two."
19. Unlocks split: BAD "You can now split units." GOOD "What was joined remembers its seam."
20. Unlocks nonmind (prestige): BAD "Prestige available!" GOOD "It is too much. It was always this much."

### Log and event lines (state what happened, obliquely, in past/present tense)
21. Wave cleared: BAD "Wave 4 complete! +120 affect." GOOD "The wave is not gone; nor is it still here." (the +120 shows in the numeric HUD, not the prose)
22. Unit fused to link 3: BAD "Merge success: Pamojja unlocked." GOOD "A small yes, repeated."
23. Unit fell: BAD "Your unit died." GOOD "It is no longer held. The place keeps its shape a moment."
24. Boss arrives: BAD "Warning: boss incoming!!" GOOD "Something that was always coming has the shape of arriving."
25. Overwhelm threshold: BAD "Overwhelm at 100%, careful." GOOD "Too many to count, equal in number to one's open hands."
26. Cannot afford: BAD "Not enough affect." GOOD "Not yet enough has been felt for this." (still true: it costs affect)
27. Seat taken: BAD "Slot occupied." GOOD "Something already stands there."

### Koans (ambient; use the templates)
28. BAD (copied cadence from a text): "Form is emptiness." GOOD "The knot is not the rope; nor is it the hand that pulled."
29. BAD (false number): "One sees a hundred, equal in number to one's gold." GOOD "One sees three, equal in number to one's unanswered questions."
30. BAD (jokey): "If one clicks twice, one certainly gets carpal tunnel." GOOD "If one stays one moment longer, one certainly leaves lighter."

## Review checklist

- [ ] I wrote the mechanic in numbers first and the line does not contradict it
- [ ] No joke, pun, exclamation mark, emoji, imperative nagging, or meme register
- [ ] Not derived from any remembered line from a game or scripture; template structure only
- [ ] Concrete image is accurate to the thing (a lid, a tide, a door), not decorative
- [ ] Length limits: hint < 12 words, koan 10-18 words
- [ ] Names follow the regulation-term pattern; stats use the established words
- [ ] If a number appears, it is exact and read from data (`%v%` placeholders as in ASPECTS)
- [ ] Spelling and glyphs are inside the baked fonts (check `src/ui/type`; avoid exotic Unicode)
- [ ] When a mechanic changes, the text was updated in the same change

## Where text lives

- Game data text: `src/game/data.js` (only the mediator edits; content lanes propose rows).
- Pools: `src/game/content/**` (content lanes). Keep pools as arrays of strings per key, like `KOANS.attend`.
- Never hard-code player-visible prose in JSX; import it from data so voice review is one grep.

## Worked rewrite (how to go from mechanic to line)

Mechanic: `Mend` heals the ally with the lowest tolerance for 2.5x the caster's salience, at full charge.

1. Facts to preserve: targets one ally; the one in most need; healing, not shield; scales with salience.
2. Image that is literally accurate: attention goes to the part that is failing.
3. Pick template `X has no P, yet fills every P` or `Just as...`: "Just as warmth finds the coldest hand, so the mending finds the weakest." This is true (lowest tolerance) and says nothing about 2.5x.
4. Shipped ability text states the plain mechanic ("Mends the ally who needs it most.") while the family text carries the oblique voice. Both must be true.

Two registers, keep them separate:
- **Flavour** (family `text`, links, koans, stage hints): oblique.
- **Ability and trait `text`** (what the number does): short, literal about WHAT, silent about HOW MUCH unless it reads exact (`%v%`). Cryptic is for flavour; the rules sentence may be confusing in what it omits but never in what it states.

## Anti-patterns seen in drafts

- Mood words with no mechanic ("feels heavy") on a unit that has no weight-related effect: false.
- Plurals that lie: "Strikes five times" when `power: 5` is a damage multiplier; check `battle.js`, not the data label.
- Borrowed cadence: if a line sounds like something you have read, rewrite it from the mechanic outward.
- Capitalised abstractions stacked three deep ("The Great Stillness of Being"): replace with one concrete noun.
- Second-person commands in log lines ("You should attend"). The game observes; it does not instruct.
- Summaries of the number ("You gained 120"). The HUD shows numbers; prose shows meaning.
