/**
 * Reads the big segment digits on a blood pressure monitor's screen from a photo,
 * on the phone itself (nothing is sent anywhere). Tuned for screens like Omron's:
 * SYS, DIA and PULSE stacked on the right, a smaller PRIOR reading on the left.
 *
 * Steps: find the light LCD panel inside the dark monitor body, mark the dark
 * pixels against the local background, find the three rows of big digits on the
 * right, split each row into digits, then decide which of the seven segments of
 * each digit are dark.
 */

export interface Gray { width: number; height: number; data: Uint8ClampedArray } // one byte per pixel
export interface Box { x: number; y: number; w: number; h: number }
export interface SegResult {
  systolic: number | null
  diastolic: number | null
  pulse: number | null
  /** Where things were found, in the image's pixels (for drawing on the preview). */
  lcd: Box | null
  rows: Box[]
}

// ---------- Image helpers ----------

/** RGBA pixels to grey, shrunk so the longer side is at most maxSide. */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number, maxSide = 1000): Gray {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale))
  const data = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(height - 1, Math.floor(y / scale))
    for (let x = 0; x < w; x++) {
      const sx = Math.min(width - 1, Math.floor(x / scale))
      const i = (sy * width + sx) * 4
      data[y * w + x] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000
    }
  }
  return { width: w, height: h, data }
}

function otsu(values: Uint8ClampedArray | number[]): number {
  const hist = new Array(256).fill(0)
  for (const v of values) hist[v]++
  const total = values.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0, wB = 0, best = 0, t = 128
  for (let i = 0; i < 256; i++) {
    wB += hist[i]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += i * hist[i]
    const mB = sumB / wB, mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > best) { best = between; t = i }
  }
  return t
}

/** Connected parts of a mask (4-neighbour), as bounding boxes with pixel counts. */
function components(mask: Uint8Array, w: number, h: number): (Box & { n: number; touches: boolean })[] {
  const label = new Int32Array(w * h)
  const out: (Box & { n: number; touches: boolean })[] = []
  const stack: number[] = []
  let next = 1
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || label[s]) continue
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0, touches = false
    label[s] = next
    stack.push(s)
    while (stack.length) {
      const p = stack.pop()!
      const x = p % w, y = (p - x) / w
      n++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touches = true
      if (x > 0 && mask[p - 1] && !label[p - 1]) { label[p - 1] = next; stack.push(p - 1) }
      if (x < w - 1 && mask[p + 1] && !label[p + 1]) { label[p + 1] = next; stack.push(p + 1) }
      if (y > 0 && mask[p - w] && !label[p - w]) { label[p - w] = next; stack.push(p - w) }
      if (y < h - 1 && mask[p + w] && !label[p + w]) { label[p + w] = next; stack.push(p + w) }
    }
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n, touches })
    next++
  }
  return out
}

// ---------- Step 1: the LCD panel ----------

/** The largest light rectangle that does not touch the photo's edge (the screen inside the dark body). */
export function findLcd(img: Gray): Box | null {
  const { width: w, height: h, data } = img
  const t = otsu(data)
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) mask[i] = data[i] > t ? 1 : 0
  let best: Box | null = null, bestScore = 0
  for (const c of components(mask, w, h)) {
    if (c.touches || c.w < w * 0.15 || c.h < h * 0.1) continue
    const aspect = c.w / c.h
    if (aspect < 0.9 || aspect > 3.2) continue
    const fill = c.n / (c.w * c.h)
    if (fill < 0.45) continue
    const score = c.w * c.h * fill
    if (score > bestScore) { bestScore = score; best = c }
  }
  if (best) return best
  // No dark frame found (photo taken close up): use the whole photo.
  return { x: 0, y: 0, w, h }
}

// ---------- Step 2: dark marks on the panel ----------

/** 1 where a pixel is clearly darker than the area around it. Copes with glare and shadows. */
export function darkMask(img: Gray, box: Box): { mask: Uint8Array; w: number; h: number } {
  const { width, data } = img
  const w = box.w, h = box.h
  const sat = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += data[(box.y + y) * width + box.x + x]
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row
    }
  }
  const r = Math.max(4, Math.round(h / 6))
  const mask = new Uint8Array(w * h)
  // Contrast of the panel decides how much darker a mark must be.
  let lo = 255, hi = 0
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const v = data[(box.y + y) * width + box.x + x]
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const k = Math.max(8, (hi - lo) * 0.12)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1)
      const s = sat[y1 * (w + 1) + x1] - sat[y0 * (w + 1) + x1] - sat[y1 * (w + 1) + x0] + sat[y0 * (w + 1) + x0]
      const mean = s / ((x1 - x0) * (y1 - y0))
      mask[y * w + x] = data[(box.y + y) * width + box.x + x] < mean - k ? 1 : 0
    }
  }
  return { mask, w, h }
}

// ---------- Step 3: rows of big digits ----------

interface Band { from: number; to: number }

function bands(profile: number[], min: number, minLen: number, mergeGap: number): Band[] {
  const out: Band[] = []
  let start = -1
  for (let i = 0; i <= profile.length; i++) {
    const on = i < profile.length && profile[i] >= min
    if (on && start < 0) start = i
    if (!on && start >= 0) { out.push({ from: start, to: i }); start = -1 }
  }
  const merged: Band[] = []
  for (const b of out) {
    const last = merged[merged.length - 1]
    if (last && b.from - last.to <= mergeGap) last.to = b.to
    else merged.push({ ...b })
  }
  return merged.filter((b) => b.to - b.from >= minLen)
}

/**
 * The three tallest rows of marks in the right part of the panel, top to bottom
 * (SYS, DIA, PULSE). Small text (labels, clock) makes short rows and is left out.
 */
export function findRows(m: { mask: Uint8Array; w: number; h: number }, leftFrac = 0.42): Box[] {
  const { mask, w, h } = m
  const x0 = Math.round(w * leftFrac)
  const profile: number[] = []
  for (let y = 0; y < h; y++) {
    let n = 0
    for (let x = x0; x < w; x++) n += mask[y * w + x]
    profile.push(n)
  }
  const found = bands(profile, Math.max(2, (w - x0) * 0.02), Math.round(h * 0.08), Math.round(h * 0.02))
  const tallest = [...found].sort((a, b) => (b.to - b.from) - (a.to - a.from)).slice(0, 3).sort((a, b) => a.from - b.from)
  return tallest.map((b) => {
    // Horizontal extent of the marks in this row.
    let xs = w, xe = 0
    for (let y = b.from; y < b.to; y++) for (let x = x0; x < w; x++) if (mask[y * w + x]) { if (x < xs) xs = x; if (x > xe) xe = x }
    return { x: xs, y: b.from, w: Math.max(1, xe - xs + 1), h: b.to - b.from }
  })
}

// ---------- Step 4: digits and segments ----------

//                 a  b  c  d  e  f  g
const DIGITS: [number, number[]][] = [
  [0, [1, 1, 1, 1, 1, 1, 0]], [1, [0, 1, 1, 0, 0, 0, 0]], [2, [1, 1, 0, 1, 1, 0, 1]], [3, [1, 1, 1, 1, 0, 0, 1]],
  [4, [0, 1, 1, 0, 0, 1, 1]], [5, [1, 0, 1, 1, 0, 1, 1]], [6, [1, 0, 1, 1, 1, 1, 1]], [7, [1, 1, 1, 0, 0, 0, 0]],
  [8, [1, 1, 1, 1, 1, 1, 1]], [9, [1, 1, 1, 1, 0, 1, 1]],
]
// Other common forms: 7 with the top-left bar, 6 and 9 without their tails.
const ALT: [number, number[]][] = [[7, [1, 1, 1, 0, 0, 1, 0]], [6, [0, 0, 1, 1, 1, 1, 1]], [9, [1, 1, 1, 0, 0, 1, 1]]]

/** Segment sample areas in a digit box: [x0, x1, y0, y1] as fractions. */
const SEG_AREAS: [number, number, number, number][] = [
  [0.3, 0.7, 0.0, 0.14], // a top
  [0.72, 1.0, 0.12, 0.44], // b top right
  [0.72, 1.0, 0.56, 0.88], // c bottom right
  [0.3, 0.7, 0.86, 1.0], // d bottom
  [0.0, 0.28, 0.56, 0.88], // e bottom left
  [0.0, 0.28, 0.12, 0.44], // f top left
  [0.3, 0.7, 0.43, 0.57], // g middle
]

/** Marks in a row grouped into columns with gaps between them (upright, no slant). */
function columnBoxes(m: { mask: Uint8Array; w: number }, row: Box): Box[] {
  const { mask, w } = m
  const cols: number[] = []
  for (let x = row.x; x < row.x + row.w; x++) {
    let n = 0
    for (let y = row.y; y < row.y + row.h; y++) n += mask[y * w + x]
    cols.push(n)
  }
  return bands(cols, 1, 1, Math.max(1, Math.round(row.h * 0.05))).map((b) => {
    let ys = row.y + row.h, ye = row.y
    for (let y = row.y; y < row.y + row.h; y++) {
      for (let x = row.x + b.from; x < row.x + b.to; x++) if (mask[y * w + x]) { if (y < ys) ys = y; if (y > ye) ye = y; break }
    }
    return { x: row.x + b.from, y: ys, w: b.to - b.from, h: Math.max(1, ye - ys + 1) }
  })
}

/**
 * The digit cells of a row, right to left. Segment screens put each digit in a cell of
 * the same width and spacing, so cells are laid out from the rightmost digit; this also
 * copes with a "1" that sits close to the next digit, and with blank leading cells.
 */
function digitCells(m: { mask: Uint8Array; w: number }, row: Box): Box[] {
  // Leave out marks on the panel's edge, then anything much shorter than the digits
  // (the clock, labels, the "OK" icon).
  const boxes = columnBoxes(m, row).filter((b) => b.x > 2 && b.x + b.w < m.w - 2)
  // (A "1" has no top or bottom bar, so it is a little shorter than the other digits.)
  const tallestH = Math.max(0, ...boxes.map((b) => b.h))
  const tall = boxes.filter((b) => b.h >= tallestH * 0.65)
  if (!tall.length || tallestH < 6) return []
  const right = Math.max(...tall.map((b) => b.x + b.w))
  const top = Math.min(...tall.map((b) => b.y))
  const H = Math.max(...tall.map((b) => b.y + b.h)) - top
  // Digit width: the widest single digit (a 7 or 3 has no left side), at least half the height.
  const wide = tall.filter((b) => b.w > H * 0.35 && b.w < H * 0.8)
  const W = Math.round(Math.max(H * 0.5, ...wide.map((b) => b.w)))
  // Spacing: from right edges, which line up for almost every digit.
  let pitch = W * 1.27
  const edges = tall.map((b) => b.x + b.w).sort((a, b) => a - b)
  for (let i = edges.length - 1; i > 0; i--) {
    const d = edges[i] - edges[i - 1]
    if (d > W * 0.9 && d < W * 1.8) { pitch = d; break }
  }
  // A cell counts only if a full-height mark is in it; otherwise it is blank (null).
  return [0, 1, 2].map((k) => {
    const cell = { x: Math.round(right - W - k * pitch), y: top, w: W, h: H }
    return tall.some((t) => t.x < cell.x + cell.w && t.x + t.w > cell.x) ? cell : null
  }).filter((c, i, all) => c != null || all.slice(i).every((x) => x == null)).filter((c): c is Box => c != null)
}

function darkness(m: { mask: Uint8Array; w: number }, box: Box, area: [number, number, number, number], slant: number): number {
  const { mask, w } = m
  let on = 0, all = 0
  const ys = Math.floor(box.y + area[2] * box.h), ye = Math.ceil(box.y + area[3] * box.h)
  for (let y = ys; y < ye; y++) {
    const shift = (box.y + box.h - y) * slant
    const xs = Math.floor(box.x + area[0] * box.w + shift), xe = Math.ceil(box.x + area[1] * box.w + shift)
    for (let x = xs; x < xe; x++) {
      all++
      if (x >= 0 && x < w && mask[y * w + x]) on++
    }
  }
  return all ? on / all : 0
}

type Cell = { digit: number; miss: number } | 'blank' | null

/** One digit cell: a digit, blank, or null when it matches no digit well. */
function readCell(m: { mask: Uint8Array; w: number }, box: Box, slant: number): Cell {
  const d = SEG_AREAS.map((a) => darkness(m, box, a, slant))
  const top = Math.max(...d)
  if (top < 0.15) return 'blank'
  const on = d.map((v) => (v > Math.max(0.2, top * 0.45) ? 1 : 0))
  let best: { digit: number; miss: number } | null = null
  for (const [digit, pattern] of [...DIGITS, ...ALT]) {
    const miss = pattern.reduce((s, p, i) => s + (p !== on[i] ? 1 : 0), 0)
    if (!best || miss < best.miss) best = { digit, miss }
  }
  return best && best.miss <= 1 ? best : null
}

const SLANTS = [0, 0.04, 0.08, 0.12]

function readRow(m: { mask: Uint8Array; w: number }, row: Box): { value: number; miss: number } | null {
  const cells = digitCells(m, row)
  if (!cells.length) return null
  let best: { value: number; miss: number } | null = null
  for (const slant of SLANTS) {
    const read = cells.map((c) => readCell(m, c, slant)).reverse() // left to right
    while (read[0] === 'blank') read.shift()
    if (read.length < 2 || read.some((c) => c == null || c === 'blank')) continue
    const digits = read as { digit: number; miss: number }[]
    const value = Number(digits.map((d) => d.digit).join(''))
    const miss = digits.reduce((s, d) => s + d.miss, 0)
    if (!best || miss < best.miss) best = { value, miss }
  }
  return best
}

// ---------- All together ----------

/** A little inside the panel, so its dark edge is not taken for marks. */
const inset = (b: Box, f: number): Box => {
  const dx = Math.round(b.w * f), dy = Math.round(b.h * f)
  return { x: b.x + dx, y: b.y + dy, w: b.w - 2 * dx, h: b.h - 2 * dy }
}

/** Turns the picture by a small angle (degrees) around its centre. */
export function rotate(img: Gray, deg: number): Gray {
  if (deg === 0) return img
  const { width: w, height: h, data } = img
  const a = (deg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a)
  const cx = w / 2, cy = h / 2
  const out = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.round(cos * (x - cx) + sin * (y - cy) + cx)
      const sy = Math.round(-sin * (x - cx) + cos * (y - cy) + cy)
      out[y * w + x] = sx >= 0 && sx < w && sy >= 0 && sy < h ? data[sy * w + sx] : 0
    }
  }
  return { width: w, height: h, data: out }
}

interface Attempt { result: SegResult; score: number }

function readOnce(img: Gray): Attempt {
  const empty: SegResult = { systolic: null, diastolic: null, pulse: null, lcd: null, rows: [] }
  const found = findLcd(img)
  if (!found) return { result: empty, score: -1 }
  const lcd = inset(found, 0.025)
  const m = darkMask(img, lcd)
  const rows = findRows(m)
  const read = rows.map((r) => readRow(m, r))
  const [s = null, d = null, p = null] = read.map((r) => r?.value ?? null)
  const ok = (v: number | null, lo: number, hi: number) => v != null && v >= lo && v <= hi
  const sOk = ok(s, 60, 260), dOk = ok(d, 30, 160) && (s == null || d! < s), pOk = ok(p, 30, 220)
  const miss = read.reduce((t, r) => t + (r?.miss ?? 0), 0)
  const score = (sOk ? 10 : 0) + (dOk ? 10 : 0) + (pOk ? 6 : 0) - miss
  const abs = rows.map((r) => ({ x: r.x + lcd.x, y: r.y + lcd.y, w: r.w, h: r.h }))
  return { result: { systolic: sOk ? s : null, diastolic: dOk ? d : null, pulse: pOk ? p : null, lcd, rows: abs }, score }
}

/** Reads the screen, straightening a tilted photo by trying small angles. */
export function readMonitor(img: Gray): SegResult {
  let best = readOnce(img)
  if (best.score >= 26) return best.result
  for (const deg of [-2, 2, -4, 4, -6, 6, -8, 8, -10, 10]) {
    const a = readOnce(rotate(img, deg))
    if (a.score > best.score) best = a
    if (best.score >= 26) break
  }
  return best.result
}

/** For tuning: the digit cells and segment darkness found in each row. */
export function debugRows(img: Gray) {
  const lcd = inset(findLcd(img)!, 0.025)
  const m = darkMask(img, lcd)
  return findRows(m).map((row) => ({
    row,
    cols: columnBoxes(m, row),
    cells: digitCells(m, row).map((c) => ({ ...c, bySlant: SLANTS.map((s) => ({ s, seg: SEG_AREAS.map((a) => Math.round(darkness(m, c, a, s) * 100)), r: readCell(m, c, s) })) })),
  }))
}
