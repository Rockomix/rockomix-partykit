export type DiagnosticLevel = "debug" | "info" | "warn" | "error";

export type DiagnosticEvent = {
  sequence: number;
  timestamp: string;
  elapsedMs: number;
  level: DiagnosticLevel;
  event: string;
  route?: string;
  roomId?: string;
  role?: string;
  component?: string;
  function?: string;
  phase?: string;
  sessionId?: string;
  appVersion?: string;
  context?: Record<string, unknown>;
  error?: Record<string, unknown>;
};

export type DiagnosticInput = Omit<Partial<DiagnosticEvent>, "sequence" | "timestamp" | "elapsedMs" | "error"> & {
  event: string;
  error?: unknown;
};

const EVENTS_KEY = "rockomix:diagnostics:events";
const CONTEXT_KEY = "rockomix:diagnostics:context";
const MAX_EVENTS = 400;
const MAX_STORAGE_CHARS = 400_000;
const MAX_STRING_LENGTH = 2_000;
const startedAt = Date.now();

let memoryEvents: DiagnosticEvent[] = [];
let loaded = false;
let persistenceDisabled = false;
let sequence = 0;

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "__rockomix_diagnostics_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    persistenceDisabled = true;
    return null;
  }
}

function isSensitiveKey(key: string) {
  return /password|passwd|token|secret|credential|cookie|authorization|api[-_]?key|access[-_]?key|refresh[-_]?token|set-cookie|header/i.test(key);
}

function sanitize(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  try {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "bigint") return `${value}n`;
    if (typeof value === "function" || typeof value === "symbol") return `[${typeof value}]`;
    if (depth >= 4) return "[truncated]";
    if (typeof value !== "object") return String(value);
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    if (typeof Element !== "undefined" && value instanceof Element) {
      return `[DOM ${value.nodeName}]`;
    }
    if (value instanceof Error) return normalizeError(value, depth + 1, seen);
    if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitize(item, depth + 1, seen));
    const result: Record<string, unknown> = {};
    Object.keys(value).slice(0, 40).forEach((key) => {
      if (!isSensitiveKey(key)) result[key] = sanitize((value as Record<string, unknown>)[key], depth + 1, seen);
    });
    return result;
  } catch {
    return "[unserializable]";
  }
}

function normalizeError(error: unknown, depth = 0, seen = new WeakSet<object>()): Record<string, unknown> {
  try {
    if (error instanceof Error) {
      const result: Record<string, unknown> = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      const cause = (error as Error & { cause?: unknown }).cause;
      if (cause !== undefined) result.cause = sanitize(cause, depth + 1, seen);
      return sanitize(result) as Record<string, unknown>;
    }
    if (typeof error === "string") return { message: error.slice(0, MAX_STRING_LENGTH) };
    const candidate = sanitize(error, depth + 1, seen);
    return typeof candidate === "object" && candidate !== null
      ? (candidate as Record<string, unknown>)
      : { message: String(candidate) };
  } catch {
    return { message: "[error normalization failed]" };
  }
}

function loadOnce() {
  if (loaded) return;
  loaded = true;
  try {
    const storage = persistenceDisabled ? null : safeStorage();
    const raw = storage?.getItem(EVENTS_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memoryEvents = parsed.filter((item): item is DiagnosticEvent => !!item && typeof item === "object").slice(-MAX_EVENTS);
      while (JSON.stringify(memoryEvents).length > MAX_STORAGE_CHARS && memoryEvents.length > 1) memoryEvents.shift();
      sequence = memoryEvents.reduce((max, item) => Math.max(max, Number(item.sequence) || 0), 0);
    }
  } catch {
    memoryEvents = [];
    persistenceDisabled = true;
  }
}

function persist() {
  try {
    if (persistenceDisabled) return;
    const storage = safeStorage();
    if (!storage) return;
    const serialized = JSON.stringify(memoryEvents);
    storage.setItem(EVENTS_KEY, serialized);
    storage.setItem(CONTEXT_KEY, JSON.stringify({ sequence, updatedAt: new Date().toISOString() }));
  } catch {
    persistenceDisabled = true;
  }
}

export function recordDiagnostic(input: DiagnosticInput): DiagnosticEvent | null {
  try {
    loadOnce();
    const event: DiagnosticEvent = {
      sequence: ++sequence,
      timestamp: new Date().toISOString(),
      elapsedMs: Math.max(0, Date.now() - startedAt),
      level: input.level ?? "info",
      event: String(input.event).slice(0, 200),
      route: input.route ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
      roomId: input.roomId,
      role: input.role,
      component: input.component,
      function: input.function,
      phase: input.phase,
      sessionId: input.sessionId,
      appVersion: input.appVersion ?? "0.7.0",
      context: sanitize(input.context) as Record<string, unknown> | undefined,
      error: input.error === undefined ? undefined : normalizeError(input.error),
    };
    memoryEvents = [...memoryEvents, event].slice(-MAX_EVENTS);
    while (JSON.stringify(memoryEvents).length > MAX_STORAGE_CHARS && memoryEvents.length > 1) memoryEvents.shift();
    persist();
    try {
      if (typeof console !== "undefined") console.debug("ROCKOMIX_DIAGNOSTIC", event);
    } catch { /* diagnostics must never affect the app */ }
    return event;
  } catch {
    return null;
  }
}

export function getDiagnostics(): DiagnosticEvent[] {
  try {
    loadOnce();
    return [...memoryEvents];
  } catch {
    return [];
  }
}

export function clearDiagnostics(): boolean {
  try {
    memoryEvents = [];
    sequence = 0;
    loaded = true;
    const storage = persistenceDisabled ? null : safeStorage();
    storage?.removeItem(EVENTS_KEY);
    storage?.removeItem(CONTEXT_KEY);
    return true;
  } catch {
    return false;
  }
}

export function getDiagnosticsInfo() {
  try {
    const events = getDiagnostics();
    const serialized = JSON.stringify(events);
    return { count: events.length, approximateBytes: serialized.length * 2, persistenceAvailable: !persistenceDisabled && !!safeStorage() };
  } catch {
    return { count: 0, approximateBytes: 0, persistenceAvailable: false };
  }
}

export function isDiagnosticsPersistenceAvailable() {
  try { return !persistenceDisabled && !!safeStorage(); } catch { return false; }
}

export const diagnosticsStorageKey = EVENTS_KEY;
