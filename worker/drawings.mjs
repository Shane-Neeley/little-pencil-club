// The synthetic pilot accepts a preset name only. Every pixel is generated here.
// The encoded PNG contains only IHDR, IDAT and IEND. No input image is decoded.
export const labels = Object.freeze({
  sun: 'Sun and hills',
  kite: 'Kite in the breeze',
  moon: 'Moon and stars',
});

const width = 192;
const height = 132;
const cream = [255, 249, 231];
const blue = [225, 238, 253];
const purple = [62, 53, 101];
const yellow = [255, 191, 86];

export async function drawPreset(preset) {
  const pixels = new Uint8Array(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      pixels.set(presetColor(preset, x, y), offset);
    }
  }

  const header = new Uint8Array(13);
  const dimensions = new DataView(header.buffer);
  dimensions.setUint32(0, width);
  dimensions.setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8);
  const compressed = await new Response(
    new Blob([pixels]).stream().pipeThrough(new CompressionStream('deflate')),
  ).arrayBuffer();
  const output = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', new Uint8Array(compressed)),
    chunk('IEND', new Uint8Array()),
  ];
  return new Uint8Array(await new Blob(output).arrayBuffer());
}

function inCircle(x, y, cx, cy, radius) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function presetColor(preset, x, y) {
  if (preset === 'sun') {
    if (inCircle(x, y, 129, 45, 24)) return yellow;
    if (y > 99 - 20 * Math.sin(x / 31)) return [127, 174, 120];
    if (y > 100 - 28 * Math.cos(x / 32 + 2)) return [177, 205, 137];
    return cream;
  }

  if (preset === 'kite') {
    if (Math.abs(x - 97) * 1.35 + Math.abs(y - 47) < 37) {
      return (x < 97) === (y < 47) ? [210, 82, 104] : [137, 104, 189];
    }
    if (y > 80 && y < 119 && Math.abs(x - 97 - 12 * Math.sin((y - 80) / 9)) < 2) return purple;
    return blue;
  }

  if (inCircle(x, y, 89, 63, 33) && !inCircle(x, y, 104, 49, 31)) return yellow;
  const stars = [[35, 39], [46, 99], [134, 36], [150, 83], [117, 104]];
  if (stars.some(([sx, sy]) => Math.abs(x - sx) + Math.abs(y - sy) < 5)) return cream;
  return purple;
}

function chunk(name, data) {
  const bytes = new Uint8Array(data.length + 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  bytes.set(new TextEncoder().encode(name), 4);
  bytes.set(data, 8);

  // PNG CRC-32 includes the chunk name and data.
  let crc = 0xffffffff;
  for (const byte of bytes.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  view.setUint32(bytes.length - 4, crc ^ 0xffffffff);
  return bytes;
}
