// Grab reference Sokoban level sets from GitHub (Node fetch is the only working egress here).
import { writeFile } from 'node:fs/promises';

const get = async (u, tries = 6) => {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'dsh', Accept: 'application/vnd.github+json' } });
      if (r.ok) return r;
      err = new Error(`${r.status} ${u}`);
    } catch (e) {
      err = e;
    }
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  throw err;
};

async function grab(repo, path, out) {
  const meta = await (await get(`https://api.github.com/repos/${repo}`)).json();
  const ref = meta.default_branch;
  const txt = await (await get(`https://raw.githubusercontent.com/${repo}/${ref}/${encodeURI(path)}`)).text();
  await writeFile(out, txt);
  console.log(`${repo}/${path} -> ${out} (${txt.length} bytes, ref=${ref})`);
  return txt;
}

const a = await grab('tiennm99/sokoban', 'src/lib/data/microban-levels.js', 'tools/ref-microban.js');
const b = await grab('cyg20212223-ops/sokoban', 'levels.js', 'tools/ref-levels2.js');
console.log('--- microban head ---\n' + a.slice(0, 500));
console.log('--- levels2 head ---\n' + b.slice(0, 400));
