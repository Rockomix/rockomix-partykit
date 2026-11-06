import { SOUND_BY_ID } from "~/constants/audio";
import { SOUND_FILE_PATHS } from "~/generated/sound-inventory";
import type { SoundInventoryItem } from "~/shared/party-types";
import SoundPadAdmin from "./soundpad-admin";

function getFileName(soundPath: string) {
  return soundPath.split("/").pop() ?? soundPath;
}

function getFolder(soundPath: string) {
  const parts = soundPath.split("/").filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "root";
}

function createSoundInventory(): SoundInventoryItem[] {
  const catalogItems = Object.entries(SOUND_BY_ID).map(([soundId, path]) => ({
    key: `catalog:${soundId}`,
    path,
    name: getFileName(path),
    folder: getFolder(path),
    origin: "catalog" as const,
    soundId,
  }));

  const catalogPaths = new Set<string>(catalogItems.map((item) => item.path));
  const discoveredItems = SOUND_FILE_PATHS.filter(
    (path) => !catalogPaths.has(path),
  ).map((path) => ({
    key: `file:${path}`,
    path,
    name: getFileName(path),
    folder: getFolder(path),
    origin: "file" as const,
    soundId: null,
  }));

  return [...catalogItems, ...discoveredItems];
}

export default function SoundPadPage() {
  return <SoundPadAdmin inventory={createSoundInventory()} />;
}
