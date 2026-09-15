// One-off generator for the HotRocks tab bar icons (list / timer / person),
// drawn as simple filled glyphs so `renderingMode="template"` can tint them.
// Run with: node scripts/generate-tab-icons.js
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'images', 'tabIcons');

function makeCanvas(size) {
  const png = new PNG({ width: size, height: size });
  png.data.fill(0);
  return png;
}

function setPixel(png, x, y, alpha) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  const existing = png.data[idx + 3];
  const a = Math.max(existing, Math.round(alpha * 255));
  png.data[idx] = 0;
  png.data[idx + 1] = 0;
  png.data[idx + 2] = 0;
  png.data[idx + 3] = a;
}

function fillRoundRect(png, cx, cy, w, h, radius) {
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  for (let y = Math.floor(y0); y <= Math.ceil(y0 + h); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x0 + w); x++) {
      const px = x - x0;
      const py = y - y0;
      const inRect = px >= radius && px <= w - radius ? py >= 0 && py <= h : px >= 0 && px <= w && py >= radius && py <= h - radius;
      let inside = inRect;
      if (!inside) {
        const cornerX = px < radius ? radius : px > w - radius ? w - radius : px;
        const cornerY = py < radius ? radius : py > h - radius ? h - radius : py;
        const d = Math.hypot(px - cornerX, py - cornerY);
        inside = d <= radius;
      }
      if (inside) setPixel(png, x, y, 1);
    }
  }
}

function strokeCircle(png, cx, cy, r, thickness) {
  for (let y = Math.floor(cy - r - thickness); y <= Math.ceil(cy + r + thickness); y++) {
    for (let x = Math.floor(cx - r - thickness); x <= Math.ceil(cx + r + thickness); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d >= r - thickness / 2 && d <= r + thickness / 2) setPixel(png, x, y, 1);
    }
  }
}

function fillCircle(png, cx, cy, r) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (Math.hypot(x - cx, y - cy) <= r) setPixel(png, x, y, 1);
    }
  }
}

function fillRect(png, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) setPixel(png, x, y, 1);
  }
}

function drawList(size) {
  const png = makeCanvas(size);
  const s = size / 24;
  const barH = 2.4 * s;
  const gap = 6.4 * s;
  const left = 4 * s;
  const dotR = 1.3 * s;
  [6, 12, 18].forEach((cy) => {
    fillCircle(png, left, cy * s, dotR);
    fillRoundRect(png, left + 5 * s + (20 * s - left - 5 * s) / 2, cy * s, 20 * s - left - 5 * s, barH, barH / 2);
  });
  return png;
}

function drawTimer(size) {
  const png = makeCanvas(size);
  const s = size / 24;
  const cx = 12 * s;
  const cy = 13 * s;
  strokeCircle(png, cx, cy, 8 * s, 2.2 * s);
  fillRect(png, cx - 1 * s, cy - 7 * s, 2 * s, 4 * s);
  fillRect(png, cx - 1 * s, cy - 1 * s, 5 * s, 2 * s);
  fillRect(png, 9 * s, 2 * s, 6 * s, 2 * s);
  return png;
}

function drawPerson(size) {
  const png = makeCanvas(size);
  const s = size / 24;
  fillCircle(png, 12 * s, 8 * s, 4 * s);
  // shoulders: bottom half of a wider circle, clipped
  for (let y = 14 * s; y <= 21 * s; y++) {
    for (let x = 3 * s; x <= 21 * s; x++) {
      const d = Math.hypot(x - 12 * s, y - 15 * s);
      if (d <= 9 * s) setPixel(png, Math.round(x), Math.round(y), 1);
    }
  }
  return png;
}

const ICONS = { list: drawList, timer: drawTimer, person: drawPerson };
const SCALES = [
  ['', 1],
  ['@2x', 2],
  ['@3x', 3],
];
const BASE = 24;

for (const [name, draw] of Object.entries(ICONS)) {
  for (const [suffix, scale] of SCALES) {
    const png = draw(BASE * scale);
    const buffer = PNG.sync.write(png);
    fs.writeFileSync(path.join(OUT_DIR, `${name}${suffix}.png`), buffer);
  }
}

console.log('Generated tab icons:', Object.keys(ICONS).join(', '));
