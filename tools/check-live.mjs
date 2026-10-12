// Smoke-check the deployed GitHub Pages site.
// Usage: node tools/check-live.mjs [baseUrl]
const base = (process.argv[2] || 'https://gj0139.github.io/sokoban/').replace(/\/?$/, '/');

const get = async (u) => {
  const r = await fetch(u, { headers: { 'User-Agent': 'dsh-deploy-check' } });
  return { r, html: await r.text() };
};

const root = await get(base);
console.log(`GET ${base} -> ${root.r.status}, ${root.html.length} bytes`);
const rootChecks = {
  status200: root.r.status === 200,
  forwardsToGame: root.html.includes('sokoban.html'),
};

const game = await get(base + 'sokoban.html');
console.log(`GET ${base} sokoban.html -> ${game.r.status}, ${game.html.length} bytes`);
const gameChecks = {
  status200: game.r.status === 200,
  hasEngine: /<script id="engine">/.test(game.html),
  hasLevels: (game.html.match(/const LEVELS/g) || []).length === 1,
  hasTitle: /<title>推箱子/.test(game.html),
  hasUndo: game.html.includes('撤销'),
};

let failed = false;
for (const [name, checks] of [['index', rootChecks], ['game', gameChecks]]) {
  for (const [k, v] of Object.entries(checks)) {
    console.log(`  ${name}.${k}: ${v}`);
    if (v !== true) failed = true;
  }
}
console.log(failed ? 'FAILED: live site is not serving the game correctly' : 'OK: live site serves the game');
process.exit(failed ? 1 : 0);
