import { describe, expect, test } from "bun:test"

import {
  acceptCatalog,
  bindPermissionReply,
  resolveStop,
  retainTarget,
  selectCodingTarget,
  type CodingTarget,
} from "../src/server/routing"

const project = "/work/demo"
const alpha: CodingTarget = { sessionID: "ses_a", title: "Alpha", directory: project }
const beta: CodingTarget = { sessionID: "ses_b", title: "Beta", directory: project }
const other: CodingTarget = { sessionID: "ses_c", title: "Other project", directory: "/work/other" }
const catalog = [alpha, beta, other]

describe("coding-session routing", () => {
  test("starts on the initiating session and ignores focus changes", () => {
    expect(retainTarget(alpha, beta.sessionID)).toEqual(alpha)
  })

  test("switches only after confirmation and only within the same project", () => {
    expect(selectCodingTarget({ current: alpha, catalog, sessionID: beta.sessionID, confirmed: false })).toEqual({
      ok: false,
      reason: "Confirm before switching from Alpha to Beta. No target was changed.",
    })
    const switched = selectCodingTarget({ current: alpha, catalog, sessionID: beta.sessionID, confirmed: true })
    expect(switched.ok).toBe(true)
    if (switched.ok) expect(switched.value.target).toEqual(beta)
  })

  test("rejects a missing session or another project without falling back", () => {
    expect(selectCodingTarget({ current: alpha, catalog, sessionID: "missing", confirmed: true }).ok).toBe(false)
    const rejected = selectCodingTarget({ current: alpha, catalog, sessionID: other.sessionID, confirmed: true })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.reason).toContain("another project")
  })

  test("a closed current target blocks new work but keeps its name", () => {
    const accepted = acceptCatalog(alpha, [beta])
    expect(accepted.currentAvailable).toBe(false)
    expect(accepted.catalog[0]).toEqual(alpha)
  })
})

describe("permission binding", () => {
  test("answers the originating session after the active target changes", () => {
    const requests = [{ id: "perm_a", sessionID: alpha.sessionID, title: alpha.title }]
    const bound = bindPermissionReply(requests, "perm_a")
    expect(bound.ok).toBe(true)
    if (bound.ok) expect(bound.value.sessionID).toBe(alpha.sessionID)
  })

  test("rejects an unknown token and asks when two requests are pending", () => {
    const requests = [
      { id: "perm_a", sessionID: alpha.sessionID, title: alpha.title },
      { id: "perm_b", sessionID: beta.sessionID, title: beta.title },
    ]
    expect(bindPermissionReply(requests, "old").ok).toBe(false)
    expect(
      bindPermissionReply([...requests, { id: "perm_a", sessionID: beta.sessionID, title: beta.title }], "perm_a").ok,
    ).toBe(false)
  })
})

describe("stopping work after a target switch", () => {
  test("does not guess when two sessions are busy", () => {
    const busy = [
      { sessionID: alpha.sessionID, title: alpha.title },
      { sessionID: beta.sessionID, title: beta.title },
    ]
    expect(resolveStop(busy).ok).toBe(false)
    expect(resolveStop(busy, alpha.sessionID)).toEqual({ ok: true, value: { sessionID: alpha.sessionID } })
  })
})
