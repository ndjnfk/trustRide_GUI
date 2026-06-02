// Generates TrustRides PWA icons (pure Node, no deps).
// Run: node scripts/generate-pwa-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// ---- tiny pixel canvas ------------------------------------------------------
function canvas(size) {
  const buf = new Uint8Array(size * size * 4); // RGBA
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const ia = a / 255;
    buf[i] = r * ia + buf[i] * (1 - ia);
    buf[i + 1] = g * ia + buf[i + 1] * (1 - ia);
    buf[i + 2] = b * ia + buf[i + 2] * (1 - ia);
    buf[i + 3] = Math.max(buf[i + 3], a);
  };
  return { size, buf, set };
}

const lerp = (a, b, t) => a + (b - a) * t;

// vertical gradient background, optional rounded corners
function background(c, top, bot, radius) {
  const { size, set } = c;
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const r = Math.round(lerp(top[0], bot[0], t));
    const g = Math.round(lerp(top[1], bot[1], t));
    const b = Math.round(lerp(top[2], bot[2], t));
    for (let x = 0; x < size; x++) {
      if (radius > 0) {
        // round the 4 corners
        const cx = x < radius ? radius : x > size - radius ? size - radius : x;
        const cy = y < radius ? radius : y > size - radius ? size - radius : y;
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > radius * radius) continue;
      }
      set(x, y, r, g, b, 255);
    }
  }
}

function roundedRect(c, x0, y0, w, h, r, col) {
  const { set } = c;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x, py = y;
      const cx = px < r ? r : px > w - r ? w - r : px;
      const cy = py < r ? r : py > h - r ? h - r : py;
      const dx = px - cx, dy = py - cy;
      if (dx * dx + dy * dy > r * r) continue;
      set(Math.round(x0 + x), Math.round(y0 + y), col[0], col[1], col[2], 255);
    }
  }
}

function disc(c, cx, cy, r, col) {
  const { set } = c;
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) set(Math.round(cx + x), Math.round(cy + y), col[0], col[1], col[2], 255);
}

// Draws the TrustRides "ascending bars + spark" mark inside a 32x32 grid
// mapped to [ox, oy] origin at the given scale.
function logo(c, ox, oy, scale) {
  const white = [255, 255, 255];
  const amber = [245, 158, 11];
  const S = (v) => v * scale;
  const rectR = S(1.4);
  // bars: x,y,w,h in the 32-grid (bottoms aligned at y=30)
  roundedRect(c, ox + S(2), oy + S(18), S(6), S(12), rectR, white); // short
  roundedRect(c, ox + S(11), oy + S(10), S(6), S(20), rectR, white); // mid
  roundedRect(c, ox + S(20), oy + S(4), S(6), S(26), rectR, white); // tall
  disc(c, ox + S(27), oy + S(4), S(3.2), amber); // spark
}

// ---- PNG encoder (RGBA, 8-bit) ----------------------------------------------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(c) {
  const { size, buf } = c;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // rows with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(buf.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- build the set ----------------------------------------------------------
const TOP = [59, 130, 246];   // #3b82f6
const BOT = [29, 64, 175];    // #1d40af

function make(size, { maskable = false, rounded = true } = {}) {
  const c = canvas(size);
  const radius = maskable ? 0 : Math.round(size * 0.22);
  background(c, TOP, BOT, radius);
  // logo content scaled into a centered box. Smaller safe area for maskable.
  const frac = maskable ? 0.58 : 0.66;
  const box = size * frac;
  const scale = box / 32;
  const ox = (size - box) / 2;
  const oy = (size - box) / 2;
  logo(c, ox, oy, scale);
  return encodePNG(c);
}

const files = [
  ['icon-192.png', make(192)],
  ['icon-512.png', make(512)],
  ['icon-maskable-512.png', make(512, { maskable: true })],
  ['apple-touch-icon-180.png', make(180, { maskable: true })],
];

for (const [name, data] of files) {
  writeFileSync(join(OUT, name), data);
  console.log('wrote', name, data.length, 'bytes');
}
console.log('Done ->', OUT);
