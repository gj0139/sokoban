// Engine tests for sokoban.html — run with: node --test tools/engine.test.mjs
// TDD rule: these must FAIL (assertion, not typo) before the engine is implemented.
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const HTML = 'sokoban.html';

async function loadEngine() {
  const html = await readFile(new URL('../' + HTML, import.meta.url), 'utf8');
  const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
  assert.ok(m, 'sokoban.html must contain <script id="engine">…</script>');
  // Same realm as the tests: vm contexts give objects a foreign Object.prototype,
  // which makes deepStrictEqual comparisons meaningless.
  const factory = new Function(`${m[1]}\n;return globalThis.Sokoban;`);
  const Sokoban = factory();
  assert.ok(Sokoban, 'engine must expose globalThis.Sokoban');
  return Sokoban;
}

// Microban #1 (David W. Skinner)
const LEVEL = `####
# .#
#  ###
#*@  #
#  $ #
#  ###
####`;
// Trivial arena: player (1,1), open floor to the right
const ARENA = '#####\n#@  #\n#####';
// Player (1,1) · box (2,1) · open floor beyond
const PUSH = '#######\n#@$   #\n#######';
// Box already one step from the right wall
const PINNED = '####\n#@$#\n####';

test('parse: grid size, player, boxes and goals counted', async () => {
  const { parseLevel } = await loadEngine();
  const lvl = parseLevel(LEVEL);
  assert.equal(lvl.width, 6);
  assert.equal(lvl.height, 7);
  assert.deepEqual(lvl.player, { x: 2, y: 3 });
  assert.equal(lvl.boxes.length, 2);
  assert.equal(lvl.goals.flat().filter(Boolean).length, 2, 'goals is the 2D grid the renderer reads');
  assert.ok(lvl.walls.flat().some(Boolean), 'walls detected');
});

test('parse: void cells outside the wall shell are not floor', async () => {
  const { parseLevel } = await loadEngine();
  const lvl = parseLevel('  ####\n  #@.#\n  ####');
  assert.equal(lvl.floor[0][0], false, 'leading padding must stay void');
  assert.equal(lvl.floor[1][3], true, 'player cell must be floor');
});

test('move: walking into a wall does nothing', async () => {
  const { createGame } = await loadEngine();
  const g = createGame(ARENA);
  const r = g.move('left');
  assert.equal(r.moved, false);
  assert.deepEqual(g.player, { x: 1, y: 1 });
  assert.equal(g.moveCount, 0);
});

test('move: walking onto floor advances and counts a move', async () => {
  const { createGame } = await loadEngine();
  const g = createGame(ARENA);
  const r = g.move('right');
  assert.equal(r.moved, true);
  assert.equal(r.pushed, false);
  assert.deepEqual(g.player, { x: 2, y: 1 });
  assert.equal(g.moveCount, 1);
  assert.equal(g.pushCount, 0);
});

test('move: pushing a box onto floor moves both', async () => {
  const { createGame } = await loadEngine();
  const g = createGame(PUSH);
  const r = g.move('right');
  assert.deepEqual({ moved: r.moved, pushed: r.pushed }, { moved: true, pushed: true });
  assert.deepEqual(g.player, { x: 2, y: 1 });
  assert.ok(g.boxes.some((b) => b.x === 3 && b.y === 1), 'box advanced one cell');
  assert.equal(g.moveCount, 1);
  assert.equal(g.pushCount, 1);
  assert.equal(g.isWon(), false, 'box landed on plain floor');
});

test('move: box cannot be pushed into a wall', async () => {
  const { createGame } = await loadEngine();
  const g = createGame(PINNED);
  const r = g.move('right');
  assert.equal(r.moved, false);
  assert.deepEqual(g.player, { x: 1, y: 1 });
  assert.equal(g.moveCount, 0);
  assert.equal(g.pushCount, 0);
});

test('move: two boxes in a row cannot be pushed', async () => {
  const { createGame } = await loadEngine();
  const g = createGame('######\n#@$$.#\n######');
  assert.equal(g.move('right').moved, false);
  assert.equal(g.moveCount, 0);
});

test('move: box pushed onto a goal wins the level', async () => {
  const { createGame } = await loadEngine();
  const g = createGame('#####\n#@$.#\n#####');
  const r = g.move('right');
  assert.equal(r.pushed, true);
  assert.equal(r.won, true);
  assert.equal(g.boxOnGoalCount(), 1);
  assert.equal(g.isWon(), true);
});

test('win: level is not won until every box sits on a goal', async () => {
  const { createGame } = await loadEngine();
  const g = createGame(LEVEL);
  assert.equal(g.isWon(), false);
  assert.equal(g.boxOnGoalCount(), 1, 'exactly one box starts on a goal');
});

test('undo: restores position, boxes and counters, then reports empty', async () => {
  const { createGame } = await loadEngine();
  const g = createGame(LEVEL);
  g.move('down');
  const snap = JSON.stringify({ p: g.player, b: g.boxes, m: g.moveCount, pc: g.pushCount });
  g.move('right');
  assert.equal(g.undo(), true);
  assert.equal(JSON.stringify({ p: g.player, b: g.boxes, m: g.moveCount, pc: g.pushCount }), snap);
  assert.equal(g.undo(), true, 'back to the start');
  assert.equal(g.moveCount, 0);
  assert.equal(g.undo(), false, 'history exhausted');
});

test('undo: reverses a push', async () => {
  const { createGame } = await loadEngine();
  const g = createGame(PUSH);
  g.move('right');
  assert.equal(g.undo(), true);
  assert.deepEqual(g.player, { x: 1, y: 1 });
  assert.deepEqual(g.boxes, [{ x: 2, y: 1 }]);
  assert.equal(g.pushCount, 0);
});

test('reset: returns to the initial position and clears history', async () => {
  const { createGame } = await loadEngine();
  const g = createGame(LEVEL);
  g.move('down');
  g.move('right');
  g.reset();
  assert.deepEqual(g.player, { x: 2, y: 3 });
  assert.equal(g.moveCount, 0);
  assert.equal(g.undo(), false);
});

/* ---------- responsive board sizing ---------- */

test('cellSize: a small board on desktop uses the full 44px cell', async () => {
  const { cellSize } = await loadEngine();
  assert.equal(cellSize(1080, 722, 6, 7), 44);
});

test('cellSize: never grows past 44px on a huge screen', async () => {
  const { cellSize } = await loadEngine();
  assert.equal(cellSize(2400, 2000, 4, 4), 44);
});

test('cellSize: the 30x17 finale fits inside a 390px phone', async () => {
  const { cellSize } = await loadEngine();
  const cell = cellSize(390, 844, 30, 17);
  assert.ok(cell >= 10, 'cells stay legible');
  assert.ok(cell * 30 <= 390 - 24, 'board must fit the phone width');
  assert.ok(cell * 17 <= 844 - 300, 'board must fit the available height');
});

test('cellSize: desktop leaves room for the HUD on tall boards', async () => {
  const { cellSize } = await loadEngine();
  const cell = cellSize(1080, 722, 12, 16);
  assert.ok(cell * 16 <= 722 - 300, 'tall board must not push controls off-screen');
  assert.ok(cell <= 44);
});

test('cellSize: has a 10px floor so nothing collapses', async () => {
  const { cellSize } = await loadEngine();
  assert.equal(cellSize(320, 480, 40, 30), 10);
});
