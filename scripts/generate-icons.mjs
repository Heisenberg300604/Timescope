/**
 * Generate the extension icons.
 *
 * The mark is a donut with one filled arc: the shape the product is about -
 * a proportion of time. It stays legible at 16px because it is one closed
 * form with a single high-contrast break, and it carries no text or detail
 * that would turn to mush at toolbar size.
 *
 * Rasterized here rather than shipped as SVG because Chrome's manifest wants
 * PNGs, and drawing them directly (with 4x supersampling) avoids adding an
 * image-conversion toolchain as a build dependency.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

/** Accent and track colors, matching the UI's accent token. */
const ACCENT = [37, 99, 168];
const TRACK = [148, 163, 184];
const SUPERSAMPLE = 4;

/** Fraction of the dial filled with the accent arc. */
const FILLED_TURNS = 0.68;

function renderIcon(size) {
  const s = size * SUPERSAMPLE;
  const cx = s / 2;
  const cy = s / 2;
  // Small sizes get a chunkier ring: at 16px a thin stroke anti-aliases into
  // a smudge, so the hole shrinks and the dial grows to keep the form crisp.
  const outer = s * (size <= 16 ? 0.50 : 0.47);
  const inner = s * (size <= 16 ? 0.18 : 0.21);

  // RGBA buffer, transparent by default so the icon sits on any toolbar.
  const pixels = new Uint8ClampedArray(s * s * 4);

  for (let y = 0; y < s; y += 1) {
    for (let x = 0; x < s; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > outer || dist < inner) continue;

      // Angle measured clockwise from 12 o'clock, like a clock face.
      let turn = Math.atan2(dx, -dy) / (Math.PI * 2);
      if (turn < 0) turn += 1;

      const [r, g, b] = turn <= FILLED_TURNS ? ACCENT : TRACK;
      const alpha = turn <= FILLED_TURNS ? 255 : 110;
      const i = (y * s + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = alpha;
    }
  }

  return downsample(pixels, s, size);
}

/** Box-filter the supersampled buffer down to the target size. */
function downsample(src, srcSize, size) {
  const out = new Uint8ClampedArray(size * size * 4);
  const factor = srcSize / size;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < factor; sy += 1) {
        for (let sx = 0; sx < factor; sx += 1) {
          const i = ((y * factor + sy) * srcSize + (x * factor + sx)) * 4;
          const alpha = src[i + 3];
          // Premultiply so transparent pixels do not darken the edges.
          r += src[i] * alpha;
          g += src[i + 1] * alpha;
          b += src[i + 2] * alpha;
          a += alpha;
        }
      }
      const o = (y * size + x) * 4;
      if (a > 0) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
      }
      out[o + 3] = a / (factor * factor);
    }
  }
  return out;
}

/** Minimal PNG encoder: one IHDR, one deflated IDAT, one IEND. */
function encodePng(rgba, size) {
  const stride = size * 4;
  // Each scanline is prefixed with filter type 0 (None).
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride)
      .copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  // bytes 10-12: deflate compression, adaptive filtering, no interlace (all 0)

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), encodePng(renderIcon(size), size));
  process.stdout.write(`icon-${size}.png `);
}
console.log('\nIcons written to public/icons/');
