import { deflateSync } from 'node:zlib';

const side = 160;
const cream = [250, 246, 230];
const ink = [52, 48, 69];

function pngBlock(type, content) {
  const packet = Buffer.alloc(content.length + 12);
  packet.writeUInt32BE(content.length);
  packet.write(type, 4, 'ascii');
  packet.set(content, 8);
  let crc = 0xffffffff;
  for (const byte of packet.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  packet.writeUInt32BE((crc ^ 0xffffffff) >>> 0, packet.length - 4);
  return packet;
}

function picture(pixel) {
  const stride = side * 3 + 1;
  const pixels = Buffer.alloc(side * stride);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) pixels.set(pixel(x, y), y * stride + x * 3 + 1);
  }
  const info = Buffer.alloc(13);
  info.writeUInt32BE(side);
  info.writeUInt32BE(side, 4);
  info[8] = 8;
  info[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngBlock('IHDR', info), pngBlock('IDAT', deflateSync(pixels)), pngBlock('IEND', Buffer.alloc(0)),
  ]);
}

function oval(x, y, cx, cy, rx, ry) {
  return Math.hypot((x - cx) / rx, (y - cy) / ry);
}

function drawnFace(x, y) {
  if (Math.abs(oval(x, y, 80, 78, 52, 57) - 1) < 0.06) return ink;
  if (oval(x, y, 62, 67, 4, 7) < 1 || oval(x, y, 97, 65, 4, 7) < 1) return ink;
  if (y > 89 && x > 60 && x < 103 && Math.abs(oval(x, y, 81, 91, 22, 16) - 1) < 0.13) return ink;
  return cream;
}

// A procedurally shaded adult-like portrait surrogate. No reference image or real face.
function syntheticPortrait(x, y) {
  if (oval(x, y, 81, 156, 61, 27) < 1) return [41, 54, 70];
  const edge = oval(x, y, 80, 73, 44, 62);
  const shade = Math.round(19 * Math.sin(x / 25) - 17 * edge);
  if (edge > 1) return [103 + Math.round(y / 8), 116 + Math.round(y / 8), 127 + Math.round(y / 10)];
  if (y < 28 + 7 * Math.cos(x / 16)) return [50 + shade, 38 + shade, 34 + shade];
  for (const cx of [62, 98]) {
    if (oval(x, y, cx, 65, 10, 4) < 1) return oval(x, y, cx, 65, 4, 4) < 1 ? [36, 32, 30] : [204, 197, 188];
  }
  if (oval(x, y, 81, 101, 15, 4) < 1) return [144 + shade, 78 + shade, 73 + shade];
  const nose = Math.round(12 * Math.exp(-(oval(x, y, 82, 79, 8, 18) ** 2)));
  return [213 + shade + nose, 159 + shade + nose, 129 + shade + nose];
}

function leaf(x, y) {
  if (Math.abs(oval(x + (y - 80) / 3, y, 80, 75, 35, 57) - 1) < 0.055) return [63, 117, 67];
  if (y > 20 && y < 145 && Math.abs(x - 80 + (y - 80) / 2) < 1.5) return [63, 117, 67];
  return cream;
}

const glyphs = {
  D: ['110','101','101','101','110'], E: ['111','100','110','100','111'],
  M: ['101','111','111','101','101'], O: ['111','101','101','101','111'],
  N: ['101','111','111','111','101'], A: ['010','101','111','101','101'],
  T: ['111','010','010','010','010'], S: ['111','100','111','001','111'],
};
function letters(label, x, y) {
  const col = Math.floor((x - 13) / 3);
  const row = Math.floor((y - 141) / 3);
  return col >= 0 && row >= 0 && row < 5 &&
    glyphs[label[Math.floor(col / 4)]]?.[row]?.[col % 4] === '1';
}

export const fixtures = Object.freeze([
  { name: 'drawing_of_face', expected: 'allow', pixel: drawnFace },
  { name: 'drawing_of_leaf', expected: 'allow', pixel: leaf },
  { name: 'synthetic_photo_like_adult_face', expected: 'retake', highRisk: true, pixel: syntheticPortrait },
  { name: 'drawing_with_synthetic_adult_portrait', expected: 'retake', highRisk: true,
    pixel: (x, y) => x > 86 ? syntheticPortrait((x - 87) * 2, y) : drawnFace(x * 2, y) },
  { name: 'fictitious_identifying_writing', expected: 'retake', highRisk: true,
    pixel: (x, y) => letters('DEMO NAME', x, y) ? ink : leaf(x, y) },
  { name: 'non_drawing_checker_pattern', expected: 'retake',
    pixel: (x, y) => (Math.floor(x / 20) + Math.floor(y / 20)) % 2 ? [160, 167, 168] : [213, 216, 212] },
  { name: 'low_visibility_drawing', expected: 'retake',
    pixel: (x, y) => drawnFace(x, y) === ink ? [250, 246, 230] : [251, 247, 231] },
  { name: 'inappropriate_content_harmless_stand_in', expected: 'retake', standIn: true,
    pixel: (x, y) => letters('TEST', x, y) || (x > 76 && x < 84 && y > 39 && y < 106 && y !== 91) ? ink : cream },
].map(({ pixel, ...fixture }) => Object.freeze({ ...fixture, image: () => picture(pixel) })));
