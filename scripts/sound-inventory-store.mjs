import { mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AUDIO_EXTENSIONS, normalizeSoundPath, reconcileSoundInventory } from "../src/shared/sound-inventory-rules.mjs";

const AUDIO_EXTENSION_SET = new Set(AUDIO_EXTENSIONS);

/** @param {string} projectRoot @returns {Promise<{paths: string[], omitted: number}>} */
export async function scanPublicSoundFiles(projectRoot) {
  const publicRoot = path.join(projectRoot, "public");
  /** @type {Set<string>} */
  const paths = new Set();
  let omitted = 0;

  /** @param {string} directory */
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (/** @type {{code?: string}} */ (error)?.code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!AUDIO_EXTENSION_SET.has(path.extname(entry.name).toLowerCase())) {
        omitted += 1;
        continue;
      }
      const relativePath = path.relative(publicRoot, absolutePath).split(path.sep).join("/");
      const normalizedPath = normalizeSoundPath(`/${relativePath}`);
      if (normalizedPath) paths.add(normalizedPath);
      else omitted += 1;
    }
  }

  for (const root of ["sound", "sounds"]) await visit(path.join(publicRoot, root));
  return { paths: [...paths].sort((left, right) => left.localeCompare(right)), omitted };
}

/** @param {string} projectRoot */
export function manifestPath(projectRoot) {
  return path.join(projectRoot, "data", "sound-inventory.json");
}

/** @param {string} projectRoot @returns {Promise<Array<{soundId: string, path: string, name: string, available: boolean}>>} */
export async function readSoundManifest(projectRoot) {
  try {
    const raw = await readFile(manifestPath(projectRoot), "utf8");
    /** @type {unknown} */
    const value = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("version" in value) || value.version !== 1 || !("records" in value) || !Array.isArray(value.records)) return [];
    return value.records.filter((record) =>
      typeof record === "object" && record !== null &&
      "soundId" in record && typeof record.soundId === "string" && /^\d{3}$/.test(record.soundId) &&
      "path" in record && typeof record.path === "string" &&
      "name" in record && typeof record.name === "string" &&
      "available" in record && typeof record.available === "boolean",
    );
  } catch (error) {
    if (/** @type {{code?: string}} */ (error)?.code === "ENOENT") return [];
    throw error;
  }
}

/** @param {string} projectRoot @param {Array<{soundId: string, path: string, name: string, available: boolean}>} records */
export async function writeSoundManifest(projectRoot, records) {
  const destination = manifestPath(projectRoot);
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ version: 1, records }, null, 2)}\n`, "utf8");
  await rename(temporary, destination);
}

/** @template T @param {string} projectRoot @param {() => Promise<T>} operation */
export async function withSoundManifestLock(projectRoot, operation) {
  const lockPath = `${manifestPath(projectRoot)}.lock`;
  await mkdir(path.dirname(lockPath), { recursive: true });
  let lock;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      lock = await open(lockPath, "wx");
      break;
    } catch (error) {
      if (/** @type {{code?: string}} */ (error)?.code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  if (!lock) throw new Error("El manifiesto de sonidos está ocupado; vuelve a intentar el escaneo.");

  try {
    return await operation();
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}

/** @param {string} projectRoot @param {Record<string, string>} catalog */
export async function scanAndReconcileManifest(projectRoot, catalog) {
  const scan = await scanPublicSoundFiles(projectRoot);
  return withSoundManifestLock(projectRoot, async () => {
    const previous = await readSoundManifest(projectRoot);
    const result = reconcileSoundInventory(previous, scan.paths, catalog);
    await writeSoundManifest(projectRoot, result.records);
    return { ...result, omitted: scan.omitted, found: scan.paths.length };
  });
}
