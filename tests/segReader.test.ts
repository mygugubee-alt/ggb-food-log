import { describe, expect, it } from 'vitest'
import { readMonitor, rotate, type Gray } from '../src/services/segReader'

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
