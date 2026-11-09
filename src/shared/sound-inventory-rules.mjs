export const AUDIO_EXTENSIONS = Object.freeze([".mp3", ".wav", ".ogg", ".m4a", ".aac"]);
const AUDIO_EXTENSION_SET = new Set(AUDIO_EXTENSIONS);

/** @type {Readonly<{"001": "/sounds/fxs/kikekaraoke-envivo.mp3"}>} */
export const SOUND_BY_ID = Object.freeze({
  "001": "/sounds/fxs/kikekaraoke-envivo.mp3",
});

/** @param {string} value */
export function normalizeSoundPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.includes("\\")) return null;
  if (/[?#\u0000-\u001f]/.test(value) || value.includes("%")) return null;

  const segments = value.slice(1).split("/");
  if (segments.length < 2 || !["sound", "sounds"].includes(segments[0] ?? "")) return null;
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;

  const lastSegment = segments.at(-1) ?? "";
  const extension = lastSegment.slice(lastSegment.lastIndexOf(".")).toLowerCase();
  if (!AUDIO_EXTENSION_SET.has(extension)) return null;

  return `/${segments.join("/")}`;
}

/** @param {string} soundPath */
export function soundFileName(soundPath) {
  return soundPath.split("/").at(-1) ?? soundPath;
}

/** @param {string} soundPath */
export function soundFolder(soundPath) {
  return soundPath.split("/").filter(Boolean).slice(0, -1).join("/") || "root";
}

/**
 * Reconcile discovered paths against the persistent records.
 * Existing IDs are immutable; absent records are retained; IDs are never reused.
 * @param {Array<{soundId: string, path: string, name?: string, available?: boolean}>} previous
 * @param {string[]} discoveredPaths
 * @param {Record<string, string>} [catalog]
 * @returns {{records: Array<{soundId: string, path: string, name: string, available: boolean}>, added: Array<{soundId: string, path: string, name: string, available: boolean}>, existing: Array<{soundId: string, path: string, name: string, available: boolean}>, absent: Array<{soundId: string, path: string, name: string, available: boolean}>}}
 */
export function reconcileSoundInventory(previous, discoveredPaths, catalog = {}) {
  /** @type {Map<string, {soundId: string, path: string, name: string, available: boolean}>} */
  const byPath = new Map();
  /** @type {Map<string, string>} */
  const pathById = new Map();

  for (const record of previous) {
    if (!/^\d{3}$/.test(record.soundId) || !normalizeSoundPath(record.path)) continue;
    const normalizedPath = normalizeSoundPath(record.path);
    if (!normalizedPath || byPath.has(normalizedPath) || pathById.has(record.soundId)) continue;
    const normalizedRecord = {
      soundId: record.soundId,
      path: normalizedPath,
      name: record.name ?? soundFileName(normalizedPath),
      available: Boolean(record.available),
    };
    byPath.set(normalizedPath, normalizedRecord);
    pathById.set(record.soundId, normalizedPath);
  }

  for (const [soundId, rawPath] of Object.entries(catalog)) {
    const path = normalizeSoundPath(rawPath);
    if (!path) throw new Error(`Invalid catalog sound path for ID ${soundId}`);
    const existingPath = pathById.get(soundId);
    const existingRecord = byPath.get(path);
    if (existingPath ? existingPath !== path : Boolean(existingRecord && existingRecord.soundId !== soundId)) {
      throw new Error(`Sound ID conflict while reconciling ${soundId}`);
    }
    if (!existingRecord) {
      const record = { soundId, path, name: soundFileName(path), available: false };
      byPath.set(path, record);
      pathById.set(soundId, path);
    }
  }

  /** @type {Set<string>} */
  const normalizedDiscovered = new Set();
  for (const rawPath of discoveredPaths) {
    const path = normalizeSoundPath(rawPath);
    if (path) normalizedDiscovered.add(path);
  }

  for (const record of byPath.values()) record.available = normalizedDiscovered.has(record.path);

  let highestId = Math.max(0, ...[...pathById.keys()].map((soundId) => Number(soundId)));
  /** @type {Array<{soundId: string, path: string, name: string, available: boolean}>} */
  const added = [];
  for (const path of [...normalizedDiscovered].sort((left, right) => left.localeCompare(right))) {
    if (byPath.has(path)) continue;
    if (highestId >= 999) throw new Error("Se agotaron los SoundID disponibles (001–999).");
    highestId += 1;
    const soundId = String(highestId).padStart(3, "0");
    const record = { soundId, path, name: soundFileName(path), available: true };
    byPath.set(path, record);
    pathById.set(soundId, path);
    added.push(record);
  }

  const records = [...byPath.values()].sort((left, right) => Number(left.soundId) - Number(right.soundId));
  const discoveredExisting = records.filter((record) => normalizedDiscovered.has(record.path) && !added.includes(record));
  const absent = records.filter((record) => !normalizedDiscovered.has(record.path));
  return { records, added, existing: discoveredExisting, absent };
}
