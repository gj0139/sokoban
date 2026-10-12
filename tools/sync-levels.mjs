// Rewrite the LEVELS block inside sokoban.html from the validated reference set.
// The block is regenerated mechanically so hand-transcription typos cannot creep in.
import { readFile, writeFile } from 'node:fs/promises';

const ref = await readFile(new URL('./ref-levels2.js', import.meta.url), 'utf8');
const rm = ref.match(/const LEVELS = \[([\s\S]*?)\n\];/);
const ALL = new Function(`return [${rm[1]}];`)();

const stats = (text) => {
  const flat = text.split('\n').join('');
  const c = (re) => (flat.match(re) || []).length;
  return { players: c(/[@+]/g), boxes: c(/[$*]/g), goals: c(/[.*+]/g) };
};

const picked = [];
for (let i = 0; i < ALL.length && picked.length < 20; i++) {
  const s = stats(ALL[i]);
  if (s.players === 1 && s.boxes === s.goals) picked.push(ALL[i]);
}
if (picked.length !== 20) throw new Error(`expected 20 valid levels, got ${picked.length}`);

const body = picked
  .map((lvl) => '    `' + lvl.split('\n').join('\n') + '`,')
  .join('\n');

const file = new URL('../sokoban.html', import.meta.url);
const html = await readFile(file, 'utf8');
const re = /  const LEVELS = \[[\s\S]*?\n  \];/;
if (!re.test(html)) throw new Error('LEVELS block not found in sokoban.html');
// Function replacer: a string replacer would treat "$$" in the levels as an escape.
const next = html.replace(re, () => `  const LEVELS = [\n${body}\n  ];`);
await writeFile(file, next);
console.log(`synced ${picked.length} levels into sokoban.html`);
