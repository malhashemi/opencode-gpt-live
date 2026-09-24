/** A coding session a voice call may address. Routing never follows terminal focus. */
export interface CodingTarget {
  sessionID: string
  title: string
  directory: string
}

export interface BoundPermission {
  id: string
  sessionID: string
  title: string
}

export interface BusySession {
  sessionID: string
  title: string
}

export type RouteResult<T> = { ok: true; value: T } | { ok: false; reason: string }

export function normalizeDirectory(value: string) {
  return value.replaceAll("\\", "/").replace(/\/+$/, "")
}

export function sameDirectory(left: string, right: string) {
  return !!left && !!right && normalizeDirectory(left) === normalizeDirectory(right)
}

/** Focusing another pane is not a target change. */
export function retainTarget(current: CodingTarget, _focusedSessionID?: string) {
  return current
}

export function selectCodingTarget(input: {
  current: CodingTarget
  catalog: readonly CodingTarget[]
  sessionID: string
  confirmed: boolean
}): RouteResult<{ target: CodingTarget; announcement: string }> {
  const target = input.catalog.find((item) => item.sessionID === input.sessionID)
  if (!target) {
    return { ok: false, reason: "That session is not available in this project. No target was changed." }
  }
  if (!sameDirectory(input.current.directory, target.directory)) {
    return {
      ok: false,
      reason: `Cannot control ${target.title}: it is in another project. No target was changed.`,
    }
  }
  if (target.sessionID === input.current.sessionID) {
    return { ok: true, value: { target, announcement: `Already controlling ${target.title}.` } }
  }
  if (!input.confirmed) {
    return {
      ok: false,
      reason: `Confirm before switching from ${input.current.title} to ${target.title}. No target was changed.`,
    }
  }
  return {
    ok: true,
    value: {
      target,
      announcement: `Switched the coding target from ${input.current.title} to ${target.title}. Work already running stays on its original session.`,
    },
  }
}

/** Keep same-project sessions. A missing current target stays named but is marked unavailable. */
export function acceptCatalog(current: CodingTarget, offered: readonly CodingTarget[]) {
  const catalog = offered.filter((item) => sameDirectory(current.directory, item.directory))
  const currentAvailable = catalog.some((item) => item.sessionID === current.sessionID)
  if (!currentAvailable) catalog.unshift(current)
  return { catalog, currentAvailable }
}

/** A reply is bound to the session that asked, never to whichever target is selected now. */
export function bindPermissionReply(
  requests: readonly BoundPermission[],
  requestID: string,
): RouteResult<BoundPermission> {
  const matches = requests.filter((request) => request.id === requestID)
  if (matches.length === 0) {
    return {
      ok: false,
      reason: `No pending permission ${requestID}. It may have expired, already been answered, or belong to another call.`,
    }
  }
  if (matches.length > 1) {
    return { ok: false, reason: "That permission matches more than one session. Ask which session the user means." }
  }
  return { ok: true, value: matches[0]! }
}

/** "Stop that" acts only when the session is unambiguous or explicitly named. */
export function resolveStop(
  busy: readonly BusySession[],
  requestedSessionID?: string,
): RouteResult<{ sessionID: string }> {
  const unique = [...new Map(busy.map((item) => [item.sessionID, item])).values()]
  if (requestedSessionID) {
    const match = unique.find((item) => item.sessionID === requestedSessionID)
    if (!match) return { ok: false, reason: "That session has no active work. Nothing was stopped." }
    return { ok: true, value: { sessionID: match.sessionID } }
  }
  if (unique.length === 0) return { ok: false, reason: "Nothing is running." }
  if (unique.length > 1) {
    return {
      ok: false,
      reason: `More than one session is working: ${unique.map((item) => item.title).join(", ")}. Ask which one to stop.`,
    }
  }
  return { ok: true, value: { sessionID: unique[0]!.sessionID } }
}

export function targetLabel(target: CodingTarget) {
  const project = target.directory.split(/[\\/]/).findLast(Boolean) ?? "project"
  return `${target.title} · ${project}`
}
