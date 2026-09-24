import { describe, expect, test } from "bun:test"
import { inflateSync } from "node:zlib"

import { framePixels, imageID, kittyDelete, kittyFrame } from "../src/tui/kitty"

const ESC = "\x1b"

/** Splits a frame into its APC commands: control keys and payload per chunk. */
function commands(out: string) {
  return out
    .split(`${ESC}_G`)
    .slice(1)
    .map((part) => {
      const [control, payload = ""] = part.slice(0, part.indexOf(`${ESC}\\`)).split(";")
      return {
        keys: Object.fromEntries(control.split(",").map((pair) => pair.split("=") as [string, string])),
        payload,
      }
    })
}

function frame(rgba: Uint8Array, width = 64, height = rgba.length / 4 / 64) {
  return kittyFrame({ id: 42, col: 10, row: 3, cols: 24, rows: 12, width, height, rgba })
}

function noise(length: number) {
  const bytes = new Uint8Array(length)
  let seed = 7
  for (let i = 0; i < length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0
    bytes[i] = seed >>> 24
  }
  return bytes
}

describe("kitty frame", () => {
  test("places the image at its cell and restores the cursor, in one synchronized update", () => {
    const out = frame(new Uint8Array(64 * 32 * 4))
    expect(out.startsWith(`${ESC}[?2026h${ESC}7${ESC}[4;11H${ESC}_G`)).toBe(true)
    expect(out.endsWith(`${ESC}\\${ESC}8${ESC}[?2026l`)).toBe(true)
  })

  test("transmits and places under one image and placement ID, scaled to the cell box", () => {
    const [first] = commands(frame(new Uint8Array(64 * 32 * 4)))
    expect(first.keys).toMatchObject({
      a: "T",
      f: "32",
      o: "z",
      s: "64",
      v: "32",
      i: "42",
      p: "1",
      c: "24",
      r: "12",
      C: "1",
      q: "2",
    })
    expect(Number(first.keys.z)).toBeLessThan(0)
  })

  test("chunks large payloads within the protocol limit and reassembles to the exact pixels", () => {
    const rgba = noise(64 * 128 * 4)
    const parts = commands(frame(rgba))
    expect(parts.length).toBeGreaterThan(1)
    parts.forEach((part, index) => {
      expect(part.payload.length).toBeLessThanOrEqual(4096)
      expect(part.keys.m).toBe(index === parts.length - 1 ? "0" : "1")
      if (index > 0) expect(Object.keys(part.keys).toSorted()).toEqual(["m", "q"])
    })
    const decoded = inflateSync(Buffer.from(parts.map((part) => part.payload).join(""), "base64"))
    expect(new Uint8Array(decoded)).toEqual(rgba)
  })

  test("a small frame is a single command", () => {
    const parts = commands(frame(new Uint8Array(64 * 4 * 4)))
    expect(parts).toHaveLength(1)
    expect(parts[0].keys.m).toBe("0")
  })

  test("delete removes the image and its data", () => {
    expect(kittyDelete(42)).toBe(`${ESC}_Ga=d,d=I,i=42,q=2${ESC}\\`)
  })
})

describe("kitty image IDs", () => {
  test("are stable, non-zero and differ per layer", () => {
    const panel = imageID("gptlive-aura-panel")
    expect(panel).toBe(imageID("gptlive-aura-panel"))
    expect(panel).toBeGreaterThan(0)
    expect(panel).toBeLessThan(2 ** 24)
    expect(imageID("gptlive-aura-sidebar")).not.toBe(panel)
  })
})

describe("frame pixels", () => {
  test("uses the terminal's real cell size", () => {
    // 100 x 40 cells on a 1000 x 800 pixel terminal: 10 x 20 pixel cells.
    expect(framePixels(24, 12, { width: 1000, height: 800 }, { width: 100, height: 40 })).toEqual({
      width: 240,
      height: 240,
    })
  })

  test("scales down large cells to the pixel budget, keeping the aspect ratio", () => {
    const size = framePixels(24, 12, { width: 4000, height: 3200 }, { width: 100, height: 40 })
    expect(size.width * size.height).toBeLessThanOrEqual(65_000 * 1.01)
    expect(size.width / size.height).toBeCloseTo(1, 1)
  })

  test("falls back to 8 x 16 cells when the size is unknown", () => {
    expect(framePixels(24, 12, null, { width: 100, height: 40 })).toEqual({ width: 192, height: 192 })
    expect(framePixels(24, 12, { width: 0, height: 0 }, { width: 100, height: 40 })).toEqual({
      width: 192,
      height: 192,
    })
  })
})
