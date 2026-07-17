export const SESSION_ID_KEY = "sessionId";
export const NAME_KEY = "name";

export function ensureSessionId(): string {
  if (typeof window === "undefined") return "";

  try {
    const existing = window.localStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;

    const next = (crypto && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);

    window.localStorage.setItem(SESSION_ID_KEY, next);
    return next;
  } catch {
    return "";
  }
}

export function setNameLocal(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}
