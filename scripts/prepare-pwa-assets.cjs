const fs = require("node:fs");
const path = require("node:path");
const { deflateSync } = require("node:zlib");

const root = path.resolve(__dirname, "..");
const publicDirectory = path.join(root, "public");
const iconDirectory = path.join(publicDirectory, "icons");
const { version, description, build } = require(path.join(root, "package.json"));
fs.mkdirSync(iconDirectory, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function createIcon(size) {
  const points = [
    [0.76, 0.26], [0.68, 0.19], [0.31, 0.19], [0.19, 0.31], [0.19, 0.42],
    [0.29, 0.49], [0.66, 0.56], [0.68, 0.63], [0.62, 0.69], [0.29, 0.69],
    [0.20, 0.64], [0.16, 0.77], [0.25, 0.83], [0.68, 0.83], [0.81, 0.70],
    [0.81, 0.57], [0.70, 0.47], [0.35, 0.41], [0.34, 0.36], [0.39, 0.32], [0.68, 0.32]
  ];
  const rows = Buffer.alloc((size * 4 + 1) * size);
  const background = [22, 27, 30, 255];
  const tile = [32, 54, 44, 255];
  const mark = [100, 211, 165, 255];
  const scale = 4;
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    rows[rowOffset] = 0;
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const inTile = nx > 0.08 && nx < 0.92 && ny > 0.08 && ny < 0.92;
      let color = inTile ? tile : background;
      let hits = 0;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          if (insidePolygon((x + (sx + 0.5) / scale) / size, (y + (sy + 0.5) / scale) / size, points)) hits += 1;
        }
      }
      if (hits) {
        const opacity = hits / (scale * scale);
        color = mark.map((channel, index) => Math.round(channel * opacity + color[index] * (1 - opacity)));
      }
      const offset = rowOffset + 1 + x * 4;
      rows.set(color, offset);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0))
  ]);
  fs.writeFileSync(path.join(iconDirectory, `icon-${size}.png`), png);
}

createIcon(192);
createIcon(512);

const manifest = {
  id: "./",
  name: build.productName,
  short_name: "SILVA XVI",
  description,
  start_url: "./",
  scope: "./",
  display: "standalone",
  orientation: "landscape",
  background_color: "#101114",
  theme_color: "#101114",
  icons: [192, 512].map((size) => ({
    src: `./icons/icon-${size}.png`,
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose: "any maskable"
  }))
};
fs.writeFileSync(path.join(publicDirectory, "manifest.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(publicDirectory, ".nojekyll"), "");
