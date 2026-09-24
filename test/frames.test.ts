import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import type { VoiceController } from "../src/tui/controller"
import { Frames, type View } from "../src/tui/ui"

const directory = mkdtempSync(path.join(os.tmpdir(), "gptlive-frames-"))
const log = path.join(directory, "debug.jsonl")
const previous = process.env.GPT_LIVE_DEBUG

afterEach(() => {
  if (previous === undefined) delete process.env.GPT_LIVE_DEBUG
  else process.env.GPT_LIVE_DEBUG = previous
  rmSync(directory, { recursive: true, force: true })
})

function viewErrors() {
  if (!existsSync(log)) return []
  return readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { event: string; error: string })
    .filter((entry) => entry.event === "view-error")
    .map((entry) => entry.error)
}

describe("frame clock", () => {
  test("logs a view that fails every frame once per distinct error, and keeps it mounted", () => {
    process.env.GPT_LIVE_DEBUG = log
    let listener: (() => void) | undefined
    const voice = {
      onChange(next: () => void) {
        listener = next
        return () => {}
      },
    }
    const redraw = () => listener?.()
    const frames = new Frames(voice as unknown as VoiceController)

    let failure: string | undefined = "missing hue"
    let updates = 0
    const view: View = {
      root: { isDestroyed: false } as View["root"],
      animating: () => false,
      update() {
        updates++
        if (failure) throw new Error(failure)
      },
    }

    frames.mount(view)
    for (let frame = 0; frame < 5; frame++) redraw()
    expect(viewErrors()).toEqual(["Error: missing hue"])

    failure = "another cause"
    redraw()
    expect(viewErrors()).toEqual(["Error: missing hue", "Error: another cause"])

    failure = undefined
    redraw()
    failure = "another cause"
    redraw()
    expect(viewErrors()).toEqual(["Error: missing hue", "Error: another cause", "Error: another cause"])

    // Still mounted: every frame reached the view, including the ones after it failed.
    expect(updates).toBe(9)
  })
})
