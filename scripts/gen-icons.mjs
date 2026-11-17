// Draws the app icons as PNG files with no dependencies.
import { deflateSync, crc32 } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([len, body, crc])
}
function png(size) {
  const bg = [31, 111, 92], white = [255, 255, 255], rim = [205, 228, 221]
  const raw = Buffer.alloc(size * (size * 4 + 1))
  const c = size / 2
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
  const cover = (d, r) => Math.min(1, Math.max(0, r - d + 0.5)) // 1 inside the circle, soft edge
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c)
      let col = mix(bg, white, cover(d, size * 0.33))
      col = mix(col, rim, cover(d, size * 0.235))
      col = mix(col, white, cover(d, size * 0.21))
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]; raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}
mkdirSync('public/icons', { recursive: true })
for (const [name, size] of [['icon-192', 192], ['icon-512', 512], ['apple-touch-icon', 180]]) {
  writeFileSync(`public/icons/${name}.png`, png(size))
}
console.log('icons written')
