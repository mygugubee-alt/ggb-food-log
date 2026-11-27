import { describe, expect, it } from 'vitest'
import { readMeter, readMonitor, rotate, type Gray } from '../src/services/segReader'

// Draws a monitor like the Omron in the user's photo: dark body, light screen, a small
// PRIOR reading and clock, and SYS / DIA / PULSE in big segment digits on the right.
const SEGS: Record<number, string> = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' }

function canvas(w: number, h: number, v: number): Gray {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h).fill(v) }
}
function rect(g: Gray, x: number, y: number, w: number, h: number, v: number, slant = 0, base = y + h) {
  for (let yy = Math.round(y); yy < y + h; yy++) {
    const shift = Math.round((base - yy) * slant)
    for (let xx = Math.round(x); xx < x + w; xx++) {
      const px = xx + shift
      if (px >= 0 && px < g.width && yy >= 0 && yy < g.height) g.data[yy * g.width + px] = v
    }
  }
}
function digit(g: Gray, n: number, x: number, y: number, h: number, slant = 0.06) {
  const w = h * 0.55, t = h * 0.12, gap = t * 0.25
  const on = SEGS[n]
  const S: Record<string, [number, number, number, number]> = {
    a: [x + t, y, w - 2 * t, t], d: [x + t, y + h - t, w - 2 * t, t], g: [x + t, y + h / 2 - t / 2, w - 2 * t, t],
    f: [x, y + t + gap, t, h / 2 - t - 2 * gap], b: [x + w - t, y + t + gap, t, h / 2 - t - 2 * gap],
    e: [x, y + h / 2 + gap, t, h / 2 - t - 2 * gap], c: [x + w - t, y + h / 2 + gap, t, h / 2 - t - 2 * gap],
  }
  for (const s of on) { const [a, b, c, d] = S[s]; rect(g, a, b, c, d, 60, slant, y + h) }
}
function number(g: Gray, value: number, right: number, y: number, h: number) {
  const pitch = h * 0.72
  String(value).split('').reverse().forEach((ch, i) => digit(g, Number(ch), right - h * 0.55 - i * pitch, y, h))
}
function monitor(sys: number, dia: number, pulse: number): Gray {
  const g = canvas(900, 560, 225) // table
  rect(g, 60, 60, 780, 440, 35) // body
  const L = { x: 120, y: 100, w: 540, h: 360 }
  rect(g, L.x, L.y, L.w, L.h, 195) // screen
  // PRIOR reading and clock: small digits that must be ignored.
  number(g, 116, L.x + 150, L.y + 90, 40); number(g, 74, L.x + 150, L.y + 150, 40); number(g, 72, L.x + 150, L.y + 210, 40)
  number(g, 1001, L.x + 535, L.y + 25, 18)
  rect(g, L.x + 240, L.y + 285, 30, 30, 60); rect(g, L.x + 246, L.y + 291, 18, 18, 195) // "OK" icon
  number(g, sys, L.x + 470, L.y + 40, 100)
  number(g, dia, L.x + 470, L.y + 160, 90)
  number(g, pulse, L.x + 470, L.y + 270, 70)
  return g
}

describe('reading a blood pressure monitor photo', () => {
  it('reads SYS, DIA and pulse, ignoring the PRIOR reading, clock and icons', () => {
    const r = readMonitor(monitor(121, 84, 71))
    expect([r.systolic, r.diastolic, r.pulse]).toEqual([121, 84, 71])
  })
  it('reads other values, including two-digit SYS and every digit', () => {
    for (const [s, d, p] of [[98, 63, 60], [135, 90, 88], [142, 97, 105], [160, 100, 54], [117, 76, 69]]) {
      const r = readMonitor(monitor(s, d, p))
      expect([r.systolic, r.diastolic, r.pulse]).toEqual([s, d, p])
    }
  })
  it('straightens a slightly tilted photo', () => {
    for (const deg of [-4, 3]) {
      const r = readMonitor(rotate(monitor(128, 82, 76), deg))
      expect([r.systolic, r.diastolic, r.pulse]).toEqual([128, 82, 76])
    }
  })
  it('gives nothing for a photo without a screen', () => {
    const r = readMonitor(canvas(400, 300, 128))
    expect([r.systolic, r.diastolic, r.pulse]).toEqual([null, null, null])
  })
})

// Draws a meter like the Ottai in the user's photo: dark table, white body, grey screen
// with a small date and clock, "d m" above the value, the value in big italic digits
// with a decimal point, and the unit beside it.
function meter(value: string): Gray {
  const g = canvas(700, 800, 70) // table
  rect(g, 160, 80, 380, 620, 238) // white body
  const L = { x: 210, y: 180, w: 280, h: 270 }
  rect(g, L.x, L.y, L.w, L.h, 185) // grey screen
  rect(g, L.x, L.y, L.w, 6, 120) // the screen's dark top edge
  number(g, 297, L.x + 110, L.y + 22, 28); number(g, 1710, L.x + 265, L.y + 22, 28) // date, clock
  rect(g, L.x + 45, L.y + 68, 7, 12, 60); rect(g, L.x + 60, L.y + 70, 14, 9, 60) // "d m"
  const h = 120, w = h * 0.55, pitch = h * 0.66
  const chars = value.split('')
  const digits = chars.filter((c) => c !== '.')
  const right = L.x + 205
  digits.forEach((ch, i) => {
    const k = digits.length - 1 - i
    digit(g, Number(ch), right - w - k * pitch, L.y + 92, h, 0.08)
  })
  const p = chars.indexOf('.')
  if (p > 0) {
    const after = digits.length - p // digits after the point
    const x = right - w - (after - 1) * pitch - (pitch - w) / 2 - 6
    rect(g, x, L.y + 92 + h - 12, 12, 12, 60)
  }
  rect(g, L.x + 212, L.y + 200, 30, 8, 60); rect(g, L.x + 225, L.y + 214, 5, 12, 60) // "mmol/L"
  return g
}

describe('reading a blood sugar meter photo', () => {
  it('reads the value with its decimal point, ignoring the date, clock and unit', () => {
    const r = readMeter(meter('5.9'))
    expect([r.digits, r.pointSeen]).toEqual(['5.9', true])
  })
  it('reads other values', () => {
    for (const v of ['7.2', '10.4', '12.8', '4.0', '3.6']) expect(readMeter(meter(v)).digits).toBe(v)
  })
  it('reads a whole number (mg/dL meter)', () => {
    for (const v of ['126', '98']) expect(readMeter(meter(v))).toMatchObject({ digits: v, pointSeen: false })
  })
  it('straightens a slightly tilted photo', () => {
    for (const deg of [-3, 4]) expect(readMeter(rotate(meter('6.3'), deg)).digits).toBe('6.3')
  })
  it('gives nothing for a photo without a meter', () => {
    expect(readMeter(canvas(400, 300, 128)).digits).toBeNull()
  })
})

