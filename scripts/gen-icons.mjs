// Generates PNG icons (192, 512, 512-maskable) from a simple bitmap.
// Pure Node stdlib (zlib + custom CRC32) — no native deps.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// CRC32 ---------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// PNG builder ---------------------------------------------------
function buildPng(size, paint) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc(size * (1 + stride));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + stride);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = paint(x, y, size);
      const i = rowStart + 1 + x * 4;
      raw[i] = r; raw[i+1] = g; raw[i+2] = b; raw[i+3] = a;
    }
  }
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Biopunk palette ---------------------------------------------
const BG_DEEP   = [7, 9, 10, 255];          // #07090a
const BG_TINT   = [14, 38, 32, 255];         // greenish dark
const EMERALD_A = [52, 211, 153, 255];       // #34d399
const EMERALD_B = [16, 185, 129, 255];       // #10b981
const EMERALD_C = [6, 78, 59, 255];          // #064e3b
const AMBER_A   = [251, 191, 36, 255];       // #fbbf24
const AMBER_B   = [180, 83, 9, 255];         // #b45309

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    255,
  ];
}

function radialBg(sx, sy, cx, cy, maxR) {
  const dx = sx - cx, dy = sy - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const t = Math.min(1, dist / maxR);
  return mix(BG_TINT, BG_DEEP, t);
}

function insideRoundRect(x, y, rx, ry, w, h, r) {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
  const ix = x - rx, iy = y - ry;
  const checkCorner = (cx, cy) => {
    const dx = ix - cx, dy = iy - cy;
    return dx * dx + dy * dy <= r * r;
  };
  if (ix < r && iy < r) return checkCorner(r, r);
  if (ix > w - r && iy < r) return checkCorner(w - r, r);
  if (ix < r && iy > h - r) return checkCorner(r, h - r);
  if (ix > w - r && iy > h - r) return checkCorner(w - r, h - r);
  return true;
}

function inCircle(x, y, cx, cy, r) {
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

// Distance from a point to a segment, returns nearest t in [0,1]
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = ((px - ax) * dx + (py - ay) * dy) / (len2 || 1);
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx, qy = ay + t * dy;
  const ex = px - qx, ey = py - qy;
  return Math.sqrt(ex * ex + ey * ey);
}

// Leaf shape via two bezier-like ellipses
function inLeaf(x, y, cx, cy, rx, ry, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = x - cx, dy = y - cy;
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1;
}

function paintIcon(x, y, size) {
  const sx = (x / size) * 512;
  const sy = (y / size) * 512;

  // Rounded square card 0..512
  if (!insideRoundRect(sx, sy, 0, 0, 512, 512, 96)) return [0, 0, 0, 0];

  // Background radial
  let color = radialBg(sx, sy, 256, 200, 360);

  // Mycelium filaments — thin lines radiating
  const filaments = [
    [80, 140], [432, 140],
    [40, 280], [472, 280],
    [120, 460], [392, 460],
    [256, 60],
  ];
  for (const [fx, fy] of filaments) {
    const d = distSeg(sx, sy, 256, 320, fx, fy);
    if (d < 2.2) {
      color = mix(color, EMERALD_A, 0.55);
    }
  }

  // Stem (vertical)
  const stemD = distSeg(sx, sy, 256, 410, 256, 220);
  if (stemD < 11) {
    const t = (sy - 220) / 190;
    color = mix(EMERALD_A, EMERALD_B, Math.max(0, Math.min(1, t)));
  }

  // Right green leaf (slightly elongated ellipse)
  if (inLeaf(sx, sy, 314, 200, 64, 26, -0.55)) {
    const t = (sx - 256) / 120;
    color = mix(EMERALD_B, EMERALD_A, Math.max(0, Math.min(1, t)));
  }
  // Left amber leaf
  if (inLeaf(sx, sy, 198, 230, 64, 26, 0.55)) {
    const t = (256 - sx) / 120;
    color = mix(AMBER_B, AMBER_A, Math.max(0, Math.min(1, t)));
  }

  // Sprout dot
  if (inCircle(sx, sy, 256, 210, 14)) return AMBER_A;

  return color;
}

function paintMaskable(x, y, size) {
  // Safe zone — 80% center. Fill outer with deep emerald, inner with same icon scaled.
  const cx = size / 2, cy = size / 2;
  const dx = x - cx, dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Outer ring solid dark green
  if (dist > size * 0.46) {
    return mix(EMERALD_C, BG_DEEP, 0.4);
  }

  // Render scaled icon in the safe zone (80% area)
  const scaled = size * 0.78;
  const offset = (size - scaled) / 2;
  const ix = (x - offset) / scaled * size;
  const iy = (y - offset) / scaled * size;
  if (ix < 0 || iy < 0 || ix >= size || iy >= size) {
    return mix(EMERALD_C, BG_DEEP, 0.4);
  }
  const c = paintIcon(ix, iy, size);
  if (c[3] === 0) return mix(EMERALD_C, BG_DEEP, 0.4);
  return c;
}

// Generate -----------------------------------------------------
const targets = [
  { name: 'icon-192.png',          size: 192, paint: paintIcon },
  { name: 'icon-512.png',          size: 512, paint: paintIcon },
  { name: 'icon-512-maskable.png', size: 512, paint: paintMaskable },
];

for (const t of targets) {
  const png = buildPng(t.size, t.paint);
  writeFileSync(resolve(outDir, t.name), png);
  console.log(`✔ ${t.name} (${t.size}×${t.size}, ${png.length} bytes)`);
}
