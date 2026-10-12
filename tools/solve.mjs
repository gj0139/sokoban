// BFS Sokoban solver: proves each embedded level is solvable and prints a solution.
// Run: node tools/solve.mjs [levelIndex...]
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../sokoban.html', import.meta.url), 'utf8');
const Sokoban = new Function(
  html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] + '\n;return globalThis.Sokoban;'
)();
const lm = html.match(/const LEVELS = \[([\s\S]*?)\n  \];/);
const LEVELS = new Function(`return [${lm[1]}];`)();

const DIRS = [
  ['U', 0, -1],
  ['D', 0, 1],
  ['L', -1, 0],
  ['R', 1, 0],
];

function solve(levelText, maxNodes = 3000000) {
  const g = Sokoban.createGame(levelText);
  const { width, height, walls, floor, goals } = g;
  const idx = (x, y) => y * width + x;

  const isWall = (x, y) =>
    x < 0 || y < 0 || x >= width || y >= height || walls[y][x] || !floor[y][x];

  const startBoxes = g.boxes.map((b) => idx(b.x, b.y)).sort((a, b) => a - b);
  const startPlayer = idx(g.player.x, g.player.y);
  const goalSet = new Set();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (goals[y][x]) goalSet.add(idx(x, y));
  const isGoal = (i) => goalSet.has(i);

  // Dead-square pruning (standard simple deadlock): a cell is box-reachable only if
  // some chain of pushes leads it back to a goal. Reverse-BFS from every goal,
  // assuming the player can stand on any non-wall cell — an over-approximation,
  // so pruning here can never discard a real solution.
  const boxReach = new Uint8Array(width * height);
  const queue = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isWall(x, y) && isGoal(idx(x, y))) { boxReach[idx(x, y)] = 1; queue.push(idx(x, y)); }
    }
  }
  while (queue.length) {
    const cur = queue.pop();
    const cx = cur % width, cy = (cur / width) | 0;
    for (const [, dx, dy] of DIRS) {
      // A box at (cx-dx, cy-dy) could have been pushed here only if the player
      // had room to stand two steps behind the destination.
      const bx = cx - dx, by = cy - dy;
      if (isWall(bx, by)) continue;
      if (isWall(cx - 2 * dx, cy - 2 * dy)) continue;
      const bi = idx(bx, by);
      if (boxReach[bi]) continue;
      boxReach[bi] = 1;
      queue.push(bi);
    }
  }
  // A box sitting on a cell that can never reach any goal is dead.
  const deadCell = (i) => !isGoal(i) && !boxReach[i];

  const keyOf = (p, boxes) => p + '|' + boxes.join(',');
  const start = { p: startPlayer, boxes: startBoxes, path: '' };
  const seen = new Set([keyOf(start.p, start.boxes)]);
  let frontier = [start];
  let nodes = 1;

  const won = (boxes) => boxes.every(isGoal);

  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      const px = s.p % width, py = (s.p / width) | 0;
      for (const [ch, dx, dy] of DIRS) {
        const nx = px + dx, ny = py + dy;
        if (isWall(nx, ny)) continue;
        const nIdx = idx(nx, ny);
        const bi = s.boxes.indexOf(nIdx);
        let boxes = s.boxes;
        if (bi >= 0) {
          const tx = nx + dx, ty = ny + dy;
          if (isWall(tx, ty)) continue;
          const tIdx = idx(tx, ty);
          if (s.boxes.includes(tIdx)) continue;
          if (deadCell(tIdx)) continue;
          boxes = s.boxes.slice();
          boxes[bi] = tIdx;
          boxes.sort((a, b) => a - b);
        }
        const k = keyOf(nIdx, boxes);
        if (seen.has(k)) continue;
        seen.add(k);
        nodes++;
        const path = s.path + ch;
        if (won(boxes)) return { path, nodes };
        if (nodes > maxNodes) return { path: null, nodes };
        next.push({ p: nIdx, boxes, path });
      }
    }
    frontier = next;
  }
  return { path: null, nodes };
}

const MAX_NODES = Number(process.env.SOLVE_MAX_NODES || 3000000);

const want = process.argv.slice(2).map(Number);
const targets = want.length ? want : LEVELS.map((_, i) => i);
let failed = 0;
for (const i of targets) {
  const t0 = Date.now();
  const { path, nodes } = solve(LEVELS[i], MAX_NODES);
  if (path) {
    console.log(`level ${String(i + 1).padStart(2)}: solved in ${path.length} moves (${nodes} states, ${Date.now() - t0}ms)\n            ${path}`);
  } else {
    failed++;
    console.log(`level ${String(i + 1).padStart(2)}: NO SOLUTION FOUND (gave up at ${nodes} states)`);
  }
}
if (failed) process.exitCode = 1;
