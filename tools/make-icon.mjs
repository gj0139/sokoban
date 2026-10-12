// Generate the PWA icons with no dependencies: raw PNG encoder on top of node:zlib.
// Usage: node tools/make-icon.mjs
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

/* ---------- PNG encoding ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- drawing ---------- */
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));
const inRoundRect = (u, v, x0, y0, x1, y1, r) => {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x1 - r, u));
  const cy = Math.max(y0 + r, Math.min(y1 - r, v));
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
};

function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  const BG = [15, 23, 42];        // #0f172a
  const BG_LIGHT = [29, 43, 69];  // #1d2b45
  const CRATE_TOP = [253, 230, 138];
  const CRATE_BOTTOM = [245, 158, 11];
  const SKIN = [186, 230, 253];
  const BODY = [2, 132, 199];
  const EYE = [11, 37, 54];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size, v = (y + 0.5) / size;
      // background with a soft top glow
      const glow = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0) * 1.15);
      let [r, g, b] = mix(BG, BG_LIGHT, glow * 0.85);
      let a = 255;

      // crate (bottom-left), amber gradient + inner bevel line
      if (inRoundRect(u, v, 0.08, 0.46, 0.54, 0.92, 0.07)) {
        const t = (v - 0.46) / 0.46;
        [r, g, b] = mix(CRATE_TOP, CRATE_BOTTOM, t);
        const edge = Math.min(u - 0.08, 0.54 - u, v - 0.46, 0.92 - v);
        if (edge < 0.022) [r, g, b] = mix([r, g, b], [120, 80, 10], 0.45);           // rim
        if (edge > 0.08 && edge < 0.105) [r, g, b] = mix([r, g, b], [120, 80, 10], 0.3); // inner panel
      }

      // player ball (top-right) with two eyes
      const dx = u - 0.68, dy = v - 0.30, rad = 0.205;
      const d = Math.hypot(dx, dy);
      if (d <= rad) {
        const light = Math.max(0, 1 - Math.hypot(dx + 0.07, dy + 0.08) / (rad * 1.45));
        [r, g, b] = mix(BODY, SKIN, light);
        if (d > rad - 0.018) [r, g, b] = mix([r, g, b], [1, 70, 110], 0.35);
        for (const ex of [-0.065, 0.065]) {
          if (Math.hypot(u - (0.68 + ex), v - 0.265) < 0.036) [r, g, b] = EYE;
        }
      }

      const i = (y * size + x) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
    }
  }
  return buf;
}

/* ---------- build + self-check ---------- */
await mkdir(new URL('../assets/', import.meta.url), { recursive: true });
for (const size of [192, 512]) {
  const path = new URL(`../assets/icon-${size}.png`, import.meta.url);
  const png = encodePng(size, size, render(size));
  await writeFile(path, png);

  // self-check: signature + IHDR dimensions must round-trip
  const back = await readFile(path);
  const sigOk = back[0] === 0x89 && back.subarray(1, 4).toString('ascii') === 'PNG';
  const w = back.readUInt32BE(16), h = back.readUInt32BE(20);
  if (!sigOk || w !== size || h !== size) {
    throw new Error(`icon-${size}.png failed self-check (sig=${sigOk} ${w}x${h})`);
  }
  console.log(`assets/icon-${size}.png  ${png.length} bytes  ${w}x${h}  PNG OK`);
}
