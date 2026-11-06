"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Loader2, RefreshCw, Volume2, X } from "lucide-react";
import { env } from "~/env";
import { SOUND_BY_ID } from "~/constants/audio";
import { SOUND_FILE_PATHS } from "~/generated/sound-inventory";
import type { SoundPadAssignment, SoundPadConfig } from "~/shared/party-types";

const PAD_ROWS = [[13, 14, 15, 16], [9, 10, 11, 12], [5, 6, 7, 8], [1, 2, 3, 4]] as const;

function padColors(padId: number) {
  if (padId <= 3) return "border-emerald-300/35 bg-emerald-400/[0.12]";
  if (padId === 4) return "border-amber-300/45 bg-amber-300/[0.13]";
  if (padId <= 8) return "border-slate-300/25 bg-slate-400/[0.12]";
  if (padId <= 12) return "border-slate-500/35 bg-slate-700/30";
  return "border-fuchsia-300/35 bg-fuchsia-400/[0.12]";
}

function isSoundPadConfig(value: unknown): value is SoundPadConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    "assignments" in value &&
    Array.isArray(value.assignments)
  );
}

function getErrorMessage(value: unknown, fallback: string) {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }

  return fallback;
}

function soundPathForAssignment(assignment: SoundPadAssignment) {
  if (assignment.soundPath) return assignment.soundPath;

  if (assignment.soundId) {
    return SOUND_BY_ID[assignment.soundId as keyof typeof SOUND_BY_ID] ?? null;
  }

  return null;
}

function soundIdForAssignment(assignment: SoundPadAssignment) {
  if (typeof assignment.soundId === "string" && /^\d{3}$/.test(assignment.soundId)) {
    return assignment.soundId;
  }

	return null;
}

function soundNameForAssignment(assignment: SoundPadAssignment) {
  const path = soundPathForAssignment(assignment);
  if (!path) return "Vacío";

  const fileName = path.split("/").pop() ?? path;
  return decodeURIComponent(fileName)
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ");
}

export default function CoHostSoundPadFloatingPanel({ onTriggerSound }: { onTriggerSound: (soundId: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<SoundPadConfig | null>(null);
  const [source, setSource] = useState<"general" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const baseUrl = env.NEXT_PUBLIC_PARTYKIT_URL.replace(/\/$/, "");
  const generalUrl = `${baseUrl}/soundpad?resource=soundPadGeneral`;
  const catalogPaths = useMemo(() => new Set<string>(Object.values(SOUND_BY_ID)), []);
  const discoveredPaths = useMemo(() => new Set<string>(SOUND_FILE_PATHS), []);

  const loadConfiguration = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const generalResponse = await fetch(generalUrl, { signal, cache: "no-store" });
      const generalData: unknown = await generalResponse.json();

      if (!generalResponse.ok) {
        throw new Error(getErrorMessage(generalData, "No se pudo cargar el preset general."));
      }

      if (!isSoundPadConfig(generalData)) {
        throw new Error("El preset general no tiene un formato válido.");
      }

      setConfig(generalData);
      setSource("general");
      hasLoadedRef.current = true;
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setConfig(null);
      setSource(null);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar SoundPad.");
    } finally {
      setIsLoading(false);
    }
  }, [generalUrl]);

  useEffect(() => {
    if (!isOpen || hasLoadedRef.current) return;

    const controller = new AbortController();
    void loadConfiguration(controller.signal);
    return () => controller.abort();
  }, [isOpen, loadConfiguration]);

  const getAssignment = (padId: number) =>
    config?.assignments.find((assignment) => assignment.padId === padId) ?? {
      padId,
      soundId: null,
      soundPath: null,
      volume: 1,
    };

  return (
    <>
      <button
        type="button"
        aria-label={isOpen ? "Cerrar SoundPad de CoHost" : "Abrir SoundPad de CoHost"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="fixed bottom-24 right-3 z-[120] inline-flex h-12 w-12 items-center justify-center rounded-full border border-cyan-200/30 bg-cyan-300 text-slate-950 shadow-xl shadow-cyan-950/40 transition hover:bg-cyan-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 sm:bottom-28 sm:right-5"
      >
        {isOpen ? <X className="h-5 w-5" /> : <AudioLines className="h-5 w-5" />}
      </button>

      {isOpen && (
        <aside className="fixed bottom-[7.5rem] right-3 z-[119] flex max-h-[calc(100dvh-9rem)] w-fit max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-white/15 bg-[#15181d]/[0.98] p-3 text-white shadow-2xl backdrop-blur sm:bottom-[8.5rem] sm:right-5 sm:p-4">
          <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200/85">Virtual Sound Pad</p>
              <p className="mt-1 text-[0.68rem] text-white/45">
                {source === "general" ? "Preset general" : "Cargando configuración"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => void loadConfiguration()} aria-label="Recargar configuración" className="rounded-md p-1.5 text-white/55 hover:bg-white/10 hover:text-white">
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Cerrar SoundPad" className="rounded-md p-1.5 text-white/55 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isLoading && !config ? (
            <div className="flex min-h-32 items-center justify-center text-white/55"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Cargando SoundPad...</div>
          ) : error ? (
            <div className="rounded-lg border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
              <p>{error}</p>
              <button type="button" onClick={() => void loadConfiguration()} className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-rose-200/30 px-2.5 py-1.5 text-xs font-semibold hover:bg-rose-200/10"><RefreshCw className="h-3.5 w-3.5" />Reintentar</button>
            </div>
          ) : config ? (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain pb-1 pr-1">
              <div className="mx-auto grid w-max grid-cols-[repeat(4,5.25rem)] grid-rows-4 gap-1.5">
                {PAD_ROWS.flat().map((padId) => {
                  const assignment = getAssignment(padId);
                  const isReserved = padId === 4;
                  const soundPath = soundPathForAssignment(assignment);
                  const soundId = soundIdForAssignment(assignment);
                  const soundName = soundNameForAssignment(assignment);
                  const isCatalogSound = Boolean(assignment.soundId && catalogPaths.has(soundPath ?? ""));
                  const isKnownSound = Boolean(soundId && soundPath && (catalogPaths.has(soundPath) || discoveredPaths.has(soundPath)));

                  return (
                    <button type="button" key={padId} aria-label={`PAD ${padId}: ${soundName}`} disabled={isReserved || !isKnownSound} onClick={() => { if (soundId && isKnownSound) onTriggerSound(soundId); }} className={`relative flex h-[5.25rem] w-[5.25rem] flex-col items-center justify-between rounded-lg border p-1.5 text-center ${padColors(padId)} disabled:cursor-not-allowed`}>
                      <span className="self-start text-[0.55rem] font-semibold tracking-[0.06em] text-white/65">PAD {padId}</span>
                      <span className="flex flex-1 items-center justify-center text-white/75">{isReserved ? <Volume2 className="h-5 w-5 text-amber-200/80" /> : <AudioLines className="h-5 w-5" />}</span>
                      {isReserved ? <span className="w-full text-[0.45rem] leading-tight text-amber-100/85">Reservado para 10 de calificación</span> : <span className={`w-full line-clamp-2 ${soundPath ? "text-[0.72rem] font-bold leading-[1.05]" : "text-[0.6rem] font-medium leading-tight"} text-white/80`}>{soundName}</span>}
                      {soundPath && <span className={`absolute bottom-1.5 left-1.5 h-1.5 w-1.5 rounded-full ${isKnownSound ? "bg-cyan-200" : "bg-amber-200"}`} title={isCatalogSound ? "Sonido del catálogo" : "Archivo de sonido"} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </aside>
      )}
    </>
  );
}
