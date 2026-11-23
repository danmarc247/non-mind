#!/usr/bin/env node
// Re-bakes the @pmndrs/glyph font artifacts used by src/ui/type/GlyphTicker.jsx.
//   node scripts/bake-fonts.mjs
// Source must be TTF/OTF (the glyph baker rejects WOFF/WOFF2).
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(root, 'node_modules/@pmndrs/glyph/bin/glyph.js');

const FONTS = [
  {
    input: 'src/assets/fonts/Hypermonosaturation.ttf',
    output: 'public/fonts/hyper.font.glb',
    // Basic Latin only: the face is lowercase-only, GlyphTicker lowercases its text.
    // em-size=32 keeps the atlas ~320 kB (default 64 is ~785 kB); plenty for a one-line ticker.
    args: ['--msdf', 'em-size=32', '--unicodes', 'U+0020-007E'],
  },
];

let failed = false;
for (const font of FONTS) {
  const output = resolve(root, font.output);
  mkdirSync(dirname(output), { recursive: true });
  const result = spawnSync(
    process.execPath,
    [cli, 'bake', '--input', resolve(root, font.input), '--output', output, ...font.args, '--force', '--yes'],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.status !== 0) {
    failed = true;
    console.error(`bake failed: ${font.input}`);
    continue;
  }
  console.log(`${font.output}  ${(statSync(output).size / 1024).toFixed(1)} kB`);
}
process.exit(failed ? 1 : 0);
