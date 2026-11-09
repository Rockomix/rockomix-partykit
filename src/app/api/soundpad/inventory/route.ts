import { NextResponse } from "next/server";
import { env } from "~/env";
import { SOUND_FILE_PATHS } from "~/generated/sound-inventory";
import { readSoundManifest, scanPublicSoundFiles, withSoundManifestLock, writeSoundManifest } from "../../../../../scripts/sound-inventory-store.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function inventoryUrl(resource: string) {
  const baseUrl = env.NEXT_PUBLIC_PARTYKIT_URL.replace(/\/$/, "");
  return `${baseUrl}/soundpad?resource=${resource}`;
}

function isLocalWorker() {
  const hostname = new URL(env.NEXT_PUBLIC_PARTYKIT_URL).hostname;
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

async function workerRequest(resource: string, init?: RequestInit) {
  const response = await fetch(inventoryUrl(resource), { ...init, cache: "no-store" });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
      ? data.error
      : `El Worker respondió ${response.status}.`;
    throw new Error(message);
  }
  return data;
}

export async function GET() {
  try {
    const data = await workerRequest("soundInventory");
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el inventario." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST() {
  try {
    if (env.NODE_ENV !== "development") {
      const secret = env.SOUND_INVENTORY_SYNC_SECRET;
      if (!secret) throw new Error("Configura SOUND_INVENTORY_SYNC_SECRET en la aplicación y en el Worker para actualizar el inventario en producción.");
      const data = await workerRequest("soundInventorySync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ paths: SOUND_FILE_PATHS, isCompleteScan: false }),
      });
      return NextResponse.json(
        typeof data === "object" && data !== null ? { ...data, source: "build-snapshot" } : data,
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const secret = env.SOUND_INVENTORY_SYNC_SECRET;
    if (!secret) {
      throw new Error("Configura SOUND_INVENTORY_SYNC_SECRET en .env y el mismo valor en .dev.vars para habilitar el escaneo local.");
    }
    if (!isLocalWorker()) {
      throw new Error("El escaneo del filesystem local solo puede sincronizarse con un Worker local (localhost o 127.0.0.1).");
    }

    const projectRoot = process.cwd();
    const scan = await scanPublicSoundFiles(projectRoot);
    const data = await withSoundManifestLock(projectRoot, async () => {
      const previousRecords = await readSoundManifest(projectRoot);
      const result = await workerRequest("soundInventorySync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ paths: scan.paths, previousRecords, isCompleteScan: true }),
      });

      if (typeof result !== "object" || result === null || !Array.isArray((result as { records?: unknown }).records)) {
        throw new Error("El Worker devolvió un inventario con formato inválido.");
      }
      const inventoryResult = result as unknown as { records: Array<{ soundId: string; path: string; name: string; available: boolean }> };
      await writeSoundManifest(projectRoot, inventoryResult.records);
      return result;
    });
    return NextResponse.json({ ...data, omitted: scan.omitted }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el inventario." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
