// Smoke-check the deployed GitHub Pages site, including the mobile fullscreen wiring.
// Usage: node tools/check-live.mjs [baseUrl]
const base = (process.argv[2] || 'https://gj0139.github.io/sokoban/').replace(/\/?$/, '/');

const get = async (u) => {
  const r = await fetch(u, { headers: { 'User-Agent': 'dsh-deploy-check' } });
  return { r, html: await r.text() };
};

const failed = [];
const check = (group, name, ok) => {
  console.log(`  ${group}.${name}: ${ok}`);
  if (ok !== true) failed.push(`${group}.${name}`);
};

/* --- homepage forwarder --- */
const root = await get(base);
console.log(`GET ${base} -> ${root.r.status}, ${root.html.length} bytes`);
check('index', 'status200', root.r.status === 200);
check('index', 'forwardsToGame', root.html.includes("location.replace('sokoban.html')"));
check('index', 'notReadme', root.html.length < 4000);

/* --- the game itself --- */
const game = await get(base + 'sokoban.html');
console.log(`GET ${base}sokoban.html -> ${game.r.status}, ${game.html.length} bytes`);
check('game', 'status200', game.r.status === 200);
check('game', 'hasEngine', /<script id="engine">/.test(game.html));
check('game', 'hasLevels', (game.html.match(/const LEVELS/g) || []).length === 1);
check('game', 'hasTitle', /<title>推箱子/.test(game.html));
check('game', 'hasUndo', game.html.includes('撤销'));

/* --- mobile fullscreen: page meta --- */
check('mobile', 'manifestLink', /rel="manifest"/.test(game.html));
check('mobile', 'viewportFitCover', game.html.includes('viewport-fit=cover'));
check('mobile', 'noPinchZoom', game.html.includes('user-scalable=no'));
check('mobile', 'themeColor', /name="theme-color"/.test(game.html));
check('mobile', 'appleWebAppCapable', /apple-mobile-web-app-capable/.test(game.html));
check('mobile', 'fullscreenButton', game.html.includes('id="fsBtn"'));
check('mobile', 'dvhViewport', game.html.includes('100dvh'));

/* --- PWA manifest --- */
const mf = await get(base + 'manifest.json');
console.log(`GET ${base}manifest.json -> ${mf.r.status}, ${mf.html.length} bytes`);
let manifest = null;
try { manifest = JSON.parse(mf.html); } catch { /* reported below */ }
check('manifest', 'status200', mf.r.status === 200);
check('manifest', 'parses', !!manifest);
check('manifest', 'displayFullscreen', !!manifest && manifest.display === 'fullscreen');
check('manifest', 'hasName', !!manifest && typeof manifest.name === 'string' && manifest.name.length > 0);
check('manifest', 'startUrl', !!manifest && typeof manifest.start_url === 'string');
check(
  'manifest',
  'icons192_512',
  !!manifest && Array.isArray(manifest.icons) && [192, 512].every((s) =>
    manifest.icons.some((i) => String(i.sizes) === `${s}x${s}`)
  )
);

/* --- icons must be real PNGs --- */
for (const path of ['assets/icon-192.png', 'assets/icon-512.png']) {
  const res = await fetch(base + path);
  const buf = new Uint8Array(await res.arrayBuffer());
  const png = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  console.log(`GET ${base}${path} -> ${res.status}, ${buf.length} bytes`);
  check('icon', path, res.status === 200 && png);
}

if (failed.length) {
  console.log(`FAILED: ${failed.join(', ')}`);
  process.exit(1);
}
console.log('OK: live site serves the game with mobile fullscreen wiring');
