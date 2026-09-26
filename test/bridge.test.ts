import { describe, expect, jest, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

import { Bridge, type BridgeEvents } from "../src/server/bridge"
import type { Sideband } from "../src/server/live"

const prompts = path.join(import.meta.dir, "../src/server/prompts")

describe("capability wording", () => {
  test("screen questions are not treated as project work", () => {
    const voice = readFileSync(path.join(prompts, "gpt-live/03-thinking-and-acting.md"), "utf8")
    const boundaries = readFileSync(path.join(prompts, "voice-agent/04-boundaries.md"), "utf8")
    expect(voice).toContain('questions like "can you see my screen?" need no delegation')
    expect(boundaries).toContain('never turn a temporary failure into "I cannot access the project."')
  })
})

class FakeSideband {
  readonly spoken: string[] = []
  append(text: string, channel: "speakable" | "commentary") {
    if (channel === "speakable") this.spoken.push(text)
  }
  close() {}
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type SessionEvent = { type: string; data: Record<string, unknown> }

class EventStream {
  private queued: SessionEvent[] = []
  private readers: Array<(value: SessionEvent | null) => void> = []
  private ended = false

  emit(event: SessionEvent) {
    if (this.ended) return
    const reader = this.readers.shift()
    if (reader) reader(event)
    else this.queued.push(event)
  }

  end() {
    if (this.ended) return
    this.ended = true
    for (const reader of this.readers.splice(0)) reader(null)
  }

  async *[Symbol.asyncIterator]() {
    while (!this.ended) {
      const queued = this.queued.shift()
      if (queued) {
        yield queued
        continue
      }
      // The queue has to wait for the next event; this is not a parallelizable loop.
      // oxlint-disable-next-line no-await-in-loop
      const next = await new Promise<SessionEvent | null>((resolve) => this.readers.push(resolve))
      if (next === null) return
      yield next
    }
  }
}

function harness() {
  const statuses: string[] = []
  const sideband = new FakeSideband()
  const stream = new EventStream()
  const pendingPrompts: Array<ReturnType<typeof deferred<{ id: string }>>> = []
  let ended = ""
  const events = {
    task: (id: string, _text: string, status: string) => statuses.push(`${id}:${status}`),
    activity: () => {},
    transcript: () => {},
    closed: () => {},
    error: () => {},
    end: (reason: string) => {
      ended = reason
    },
  }
  const ctx = {
    session: {
      prompt: () => {
        const pending = deferred<{ id: string }>()
        pendingPrompts.push(pending)
        return pending.promise
      },
    },
    event: {
      subscribe: () => stream,
    },
  }
  const bridge = new Bridge(
    ctx as never,
    "main",
    "voice",
    sideband as unknown as Sideband,
    events as unknown as BridgeEvents,
  )
  return {
    bridge,
    sideband,
    statuses,
    stream,
    ended: () => ended,
    prompt: () => pendingPrompts.at(-1)!,
  }
}

async function settle() {
  await Bun.sleep(0)
}

/** Lets queued promise callbacks run without relying on timers, which may be faked. */
async function flush() {
  for (let turn = 0; turn < 10; turn++) {
    // Each turn drains one round of promise callbacks; the rounds are sequential by design.
    // oxlint-disable-next-line no-await-in-loop
    await Promise.resolve()
  }
}

describe("delegated task outcomes", () => {
  test("a rejected prompt is spoken once and emits a failed status", async () => {
    const { bridge, sideband, statuses, prompt } = harness()
    const result = bridge.send("Inspect the project")
    prompt().reject(new Error("Model access is disabled"))

    await expect(result).resolves.toContain("Failed before the coding session started")
    expect(statuses).toEqual(["task_1:queued", "task_1:failed"])
    expect(sideband.spoken).toEqual([
      'The task "Inspect the project" failed before it started: Model access is disabled',
    ])
    bridge.close()
  })

  test("a queued task keeps its own result when earlier work finishes", async () => {
    const { bridge, sideband, statuses, stream, prompt } = harness()
    const first = bridge.send("Task A")
    prompt().resolve({ id: "inbox_a" })
    await first
    stream.emit({ type: "session.inbox.delivered", data: { sessionID: "main", inboxID: "inbox_a" } })
    stream.emit({ type: "session.execution.started", data: { sessionID: "main" } })
    await settle()

    const second = bridge.send("Task B")
    prompt().resolve({ id: "inbox_b" })
    await second
    stream.emit({ type: "session.text.ended", data: { sessionID: "main", text: "A is done" } })
    stream.emit({ type: "session.execution.succeeded", data: { sessionID: "main" } })
    await settle()

    expect(sideband.spoken).toEqual(['Finished the task "Task A". Outcome: A is done'])
    expect(statuses).toContain("task_2:queued")
    expect(statuses).not.toContain("task_2:done")

    stream.emit({ type: "session.inbox.delivered", data: { sessionID: "main", inboxID: "inbox_b" } })
    stream.emit({ type: "session.text.ended", data: { sessionID: "main", text: "B is done" } })
    stream.emit({ type: "session.execution.succeeded", data: { sessionID: "main" } })
    await settle()

    expect(sideband.spoken).toEqual([
      'Finished the task "Task A". Outcome: A is done',
      'Finished the task "Task B". Outcome: B is done',
    ])
    bridge.close()
  })

  test("an execution failure before inbox delivery is spoken once", async () => {
    const { bridge, sideband, statuses, stream, prompt } = harness()
    const pending = bridge.send("Inspect the project")
    prompt().resolve({ id: "inbox_1" })
    await pending
    stream.emit({ type: "session.execution.started", data: { sessionID: "main" } })
    stream.emit({
      type: "session.execution.failed",
      data: { sessionID: "main", error: { message: "Model access is disabled" } },
    })
    await settle()

    expect(statuses).toEqual(["task_1:queued", "task_1:running", "task_1:failed"])
    expect(sideband.spoken).toEqual(['The task "Inspect the project" failed: Model access is disabled'])
    bridge.close()
  })

  test("a queued task the user removes is not reported with another run's result", async () => {
    const { bridge, sideband, statuses, stream, prompt } = harness()
    const pending = bridge.send("Refactor the parser")
    prompt().resolve({ id: "inbox_1" })
    await pending
    stream.emit({ type: "session.inbox.cancelled", data: { sessionID: "main", inboxID: "inbox_1" } })
    stream.emit({ type: "session.execution.started", data: { sessionID: "main" } })
    stream.emit({ type: "session.text.ended", data: { sessionID: "main", text: "All 57 tests pass" } })
    stream.emit({ type: "session.execution.succeeded", data: { sessionID: "main" } })
    await settle()

    expect(statuses).toEqual(["task_1:queued", "task_1:cancelled"])
    expect(sideband.spoken).toEqual([])
    bridge.close()
  })

  test("a task whose prompt is still pending does not take another run's result", async () => {
    const { bridge, sideband, statuses, stream, prompt } = harness()
    const pending = bridge.send("Inspect the project")
    stream.emit({ type: "session.execution.started", data: { sessionID: "main" } })
    stream.emit({ type: "session.text.ended", data: { sessionID: "main", text: "Typed work is done" } })
    stream.emit({ type: "session.execution.succeeded", data: { sessionID: "main" } })
    await settle()
    prompt().reject(new Error("Model access is disabled"))
    await pending

    expect(statuses).toEqual(["task_1:queued", "task_1:failed"])
    expect(sideband.spoken).toEqual([
      'The task "Inspect the project" failed before it started: Model access is disabled',
    ])
    bridge.close()
  })

  test("a lost event stream reports open tasks once and ends the call after it is spoken", async () => {
    const { bridge, sideband, statuses, stream, prompt, ended } = harness()
    const pending = bridge.send("Inspect the project")
    prompt().resolve({ id: "inbox_1" })
    await pending
    jest.useFakeTimers()
    try {
      stream.end()
      await flush()

      expect(sideband.spoken).toEqual([
        'Lost track of the task "Inspect the project" when the OpenCode event stream disconnected. Its result is unknown.',
      ])
      expect(statuses).toContain("task_1:failed")
      await expect(bridge.send("Again")).rejects.toThrow("event stream is gone")
      expect(bridge.endCall()).toBe("The call is already ending.")
      expect(ended()).toBe("")
      jest.advanceTimersByTime(4_500)
      expect(ended()).toContain("Lost the OpenCode event stream")
      expect(sideband.spoken).toHaveLength(1)
    } finally {
      jest.useRealTimers()
      bridge.close()
    }
  })

  test("closing the call before the lost-stream hang-up cancels it", async () => {
    const { bridge, stream, ended } = harness()
    jest.useFakeTimers()
    try {
      stream.end()
      await flush()
      bridge.close()
      jest.advanceTimersByTime(4_500)
      expect(ended()).toBe("")
    } finally {
      jest.useRealTimers()
    }
  })
})
