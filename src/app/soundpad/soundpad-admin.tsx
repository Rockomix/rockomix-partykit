"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  Check,
  Loader2,
  MoreVertical,
  Play,
  Save,
  Search,
  Square,
  Trash2,
  Volume2,
} from "lucide-react";
import { Button } from "~/components/ui/ui/button";
import { Input } from "~/components/ui/ui/input";
import { env } from "~/env";
import type { SoundInventoryItem, SoundPadAssignment, SoundPadConfig } from "~/shared/party-types";

const PAD_ROWS = [[13, 14, 15, 16], [9, 10, 11, 12], [5, 6, 7, 8], [1, 2, 3, 4]] as const;

const createInitialConfig = (): SoundPadConfig => ({
  version: 1,
  assignments: Array.from({ length: 16 }, (_, index) => ({ padId: index + 1, soundId: null, soundPath: null, volume: 1 })),
});

function isSoundPadConfig(value: unknown): value is SoundPadConfig {
  return typeof value === "object" && value !== null && "assignments" in value;
}

function getApiError(value: unknown, fallback: string) {
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") return value.error;
  return fallback;
}

function padColors(padId: number) {
  if (padId <= 3) return "border-emerald-300/35 bg-emerald-400/[0.12] hover:bg-emerald-400/[0.2]";
  if (padId === 4) return "border-amber-300/45 bg-amber-300/[0.13]";
  if (padId <= 8) return "border-slate-300/25 bg-slate-400/[0.12] hover:bg-slate-400/[0.2]";
  if (padId <= 12) return "border-slate-500/35 bg-slate-700/30 hover:bg-slate-700/45";
  return "border-fuchsia-300/35 bg-fuchsia-400/[0.12] hover:bg-fuchsia-400/[0.2]";
}

export default function SoundPadAdmin({ inventory }: { inventory: SoundInventoryItem[] }) {
  const [soundInventory, setSoundInventory] = useState<SoundInventoryItem[]>(inventory);
  const [config, setConfig] = useState<SoundPadConfig>(createInitialConfig);
  const [selectedPadId, setSelectedPadId] = useState<number | null>(null);
  const [openMenuPadId, setOpenMenuPadId] = useState<number | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [playingPadId, setPlayingPadId] = useState<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const editVersionRef = useRef(0);
  const hasLoadedGeneralRef = useRef(false);
  const inventoryRef = useRef(soundInventory);
  const configRef = useRef(config);
  const scanLockRef = useRef(false);

  const baseUrl = env.NEXT_PUBLIC_PARTYKIT_URL.replace(/\/$/, "");
  const globalConfigUrl = `${baseUrl}/soundpad?resource=soundPadGeneral`;
  const soundEntries = useMemo(() => soundInventory, [soundInventory]);
  const filteredSounds = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return soundEntries;
    return soundEntries.filter((sound) => `${sound.name} ${sound.folder} ${sound.soundId ?? ""}`.toLowerCase().includes(query));
  }, [search, soundEntries]);

  useEffect(() => {
    inventoryRef.current = soundInventory;
  }, [soundInventory]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const stopPreview = useCallback(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    previewAudioRef.current = null;
    setPlayingPadId(null);
  }, []);

  useEffect(() => stopPreview, [stopPreview]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (openMenuPadId === null) return;
      const target = event.target as Element | null;
      if (menuRef.current?.contains(target)) return;
      if (target?.closest("[data-pad-menu-trigger='true']")) return;
      setOpenMenuPadId(null);
      setSelectorOpen(false);
      setVolumeOpen(false);
      setMenuPosition(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openMenuPadId]);

  const updateMenuPosition = useCallback(() => {
    const trigger = menuTriggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 224;
    const menuHeight = selectorOpen ? 360 : volumeOpen ? 240 : 150;
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - menuWidth - margin);
    const left = Math.min(Math.max(margin, rect.right - menuWidth), maxLeft);
    const belowSpace = window.innerHeight - rect.bottom;
    const top = belowSpace >= menuHeight ? rect.bottom + 6 : Math.max(margin, rect.top - menuHeight - 6);
    setMenuPosition({ top, left });
  }, [selectorOpen, volumeOpen]);

  useEffect(() => {
    if (openMenuPadId === null) return;
    updateMenuPosition();
    const handleViewportChange = () => updateMenuPosition();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [openMenuPadId, updateMenuPosition]);

  const fetchConfig = useCallback(async (url: string) => {
    const response = await fetch(url);
    const data: unknown = await response.json();
    if (!response.ok || !isSoundPadConfig(data)) throw new Error(getApiError(data, "No se pudo cargar la configuración."));
    return { config: data, exists: response.headers.get("X-Sound-Pad-Exists") === "true" };
  }, []);

  const saveToUrl = useCallback(async (url: string, nextConfig: SoundPadConfig) => {
    const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextConfig) });
    const data: unknown = await response.json();
    if (!response.ok || !isSoundPadConfig(data)) throw new Error(getApiError(data, "No se pudo guardar la configuración."));
    return data;
  }, []);

  const loadGeneral = useCallback(async (showMessage = true) => {
    if (configDirty || isSaving) {
      setMessage("Espera a que se guarden los cambios actuales antes de cambiar de configuración.");
      return;
    }
    setIsLoading(true);
    if (showMessage) setMessage(null);
    stopPreview();
    try {
      const result = await fetchConfig(globalConfigUrl);
      configRef.current = result.config;
      setConfig(result.config);
      setSelectedPadId(null);
      setOpenMenuPadId(null);
      setSelectorOpen(false);
      setConfigDirty(false);
      if (showMessage) setMessage("Configuración general cargada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la configuración general.");
    } finally {
      setIsLoading(false);
    }
  }, [configDirty, fetchConfig, globalConfigUrl, isSaving, stopPreview]);

  const mergeInventoryRecords = useCallback((records: unknown[]) => {
    const byPath = new Map<string, SoundInventoryItem>();
    for (const sound of inventoryRef.current) byPath.set(sound.path, sound);
    for (const raw of records) {
      if (typeof raw !== "object" || raw === null) continue;
      const record = raw as { soundId?: unknown; path?: unknown; name?: unknown; available?: unknown };
      if (typeof record.soundId !== "string" || !/^\d{3}$/.test(record.soundId) || typeof record.path !== "string") continue;
      const pathParts = record.path.split("/").filter(Boolean);
      const current = byPath.get(record.path);
      byPath.set(record.path, {
        key: current?.key ?? `file:${record.path}`,
        path: record.path,
        name: typeof record.name === "string" ? record.name : current?.name ?? record.path.split("/").pop() ?? record.path,
        folder: current?.folder ?? (pathParts.length > 1 ? pathParts.slice(0, -1).join("/") : "root"),
        origin: current?.origin ?? "file",
        soundId: record.soundId,
        available: record.available === true,
      });
    }
    const merged = [...byPath.values()].sort((left, right) => {
      if (left.available !== right.available) return left.available ? -1 : 1;
      return left.path.localeCompare(right.path);
    });
    inventoryRef.current = merged;
    setSoundInventory(merged);
    return merged;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/soundpad/inventory", { cache: "no-store" })
      .then(async (response) => {
        const data: unknown = await response.json();
        if (!response.ok) throw new Error(getApiError(data, "No se pudo cargar el inventario registrado."));
        if (typeof data !== "object" || data === null || !Array.isArray((data as { records?: unknown }).records)) {
          throw new Error("El inventario registrado tiene un formato inválido.");
        }
        if (cancelled) return;
        mergeInventoryRecords((data as { records: unknown[] }).records);
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "No se pudo cargar el inventario registrado.");
      });
    return () => { cancelled = true; };
  }, [mergeInventoryRecords]);

  const scanInventory = useCallback(async () => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setIsScanning(true);
    setMessage("Escaneando archivos de sonido...");
    try {
      const response = await fetch("/api/soundpad/inventory", { method: "POST", cache: "no-store" });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(getApiError(data, "No se pudo actualizar el inventario."));
      if (typeof data !== "object" || data === null || !Array.isArray((data as { records?: unknown }).records)) {
        throw new Error("El escaneo devolvió un inventario con formato inválido.");
      }
      const result = data as { records: unknown[]; found?: number; newCount?: number; existingCount?: number; absentCount?: number; omitted?: number; source?: string };
      mergeInventoryRecords(result.records);
      const source = result.source === "build-snapshot" ? "archivos incluidos en este despliegue" : "filesystem local";
      const omitted = typeof result.omitted === "number" ? `${result.omitted} omitidos` : "omitidos no cuantificables en producción";
      setMessage(`Actualización completada (${source}): ${result.found ?? 0} encontrados, ${result.newCount ?? 0} nuevos, ${result.existingCount ?? 0} existentes, ${result.absentCount ?? 0} ausentes y ${omitted}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el inventario.");
    } finally {
      scanLockRef.current = false;
      setIsScanning(false);
    }
  }, [mergeInventoryRecords]);

  useEffect(() => {
    if (hasLoadedGeneralRef.current) return;
    hasLoadedGeneralRef.current = true;
    void loadGeneral(false);
  }, [loadGeneral]);

  const saveConfig = useCallback(async (configToSave: SoundPadConfig = config) => {
    const editVersion = editVersionRef.current;
    setIsSaving(true);
    setMessage("Guardando...");
    try {
      const savedConfig = await saveToUrl(globalConfigUrl, configToSave);
      if (editVersion === editVersionRef.current) {
        setConfig(savedConfig);
        setConfigDirty(false);
        setMessage("Configuración general guardada.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la configuración.");
    } finally {
      setIsSaving(false);
    }
  }, [config, globalConfigUrl, saveToUrl]);

  useEffect(() => {
    if (!configDirty || isLoading || isSaving) return;
    const timer = window.setTimeout(() => {
      void saveConfig(config);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [config, configDirty, isLoading, isSaving, saveConfig]);

  const getAssignment = (padId: number) => config.assignments.find((assignment) => assignment.padId === padId) ?? { padId, soundId: null, soundPath: null, volume: 1 };

  const updateAssignment = (padId: number, update: Partial<SoundPadAssignment>) => {
    if (padId === 4) return;
    editVersionRef.current += 1;
    setConfigDirty(true);
    setConfig((current) => ({ ...current, assignments: current.assignments.map((assignment) => assignment.padId === padId ? { ...assignment, ...update } : assignment) }));
  };

  const resolveSound = (assignment: SoundPadAssignment) => {
    const registeredById = assignment.soundId
      ? soundInventory.find((sound) => sound.soundId === assignment.soundId)
      : undefined;
    if (!assignment.soundPath) return registeredById;
    if (!registeredById || registeredById.path !== assignment.soundPath) return undefined;
    return registeredById;
  };

  const previewAssignment = (padId: number, assignment: SoundPadAssignment) => {
    const sound = resolveSound(assignment);
    if (!sound || sound.available === false) return;
    stopPreview();
    const audio = new Audio(sound.path);
    audio.volume = assignment.volume;
    audio.onended = () => {
      if (previewAudioRef.current === audio) {
        previewAudioRef.current = null;
        setPlayingPadId(null);
      }
    };
    audio.onerror = () => {
      if (previewAudioRef.current === audio) {
        previewAudioRef.current = null;
        setPlayingPadId(null);
      }
    };
    previewAudioRef.current = audio;
    setPlayingPadId(padId);
    void audio.play().catch(() => {
      if (previewAudioRef.current === audio) {
        previewAudioRef.current = null;
        setPlayingPadId(null);
      }
      setMessage("El navegador bloqueó la reproducción de prueba.");
    });
  };

  const togglePadPlayback = (padId: number, assignment: SoundPadAssignment) => {
    if (playingPadId === padId) {
      stopPreview();
      return;
    }
    previewAssignment(padId, assignment);
  };

  const clearAssignment = (padId: number) => {
    if (playingPadId === padId) stopPreview();
    updateAssignment(padId, { soundId: null, soundPath: null, volume: 1 });
    setOpenMenuPadId(null);
    setSelectorOpen(false);
    setVolumeOpen(false);
    setMenuPosition(null);
  };

  const releaseAllPads = () => {
    if (!window.confirm("¿Liberar las asignaciones de sonido de todos los PADs? El inventario no se eliminará.")) return;
    stopPreview();
    editVersionRef.current += 1;
    const nextConfig: SoundPadConfig = {
      ...configRef.current,
      assignments: configRef.current.assignments.map((assignment) =>
        assignment.padId === 4 ? assignment : { ...assignment, soundId: null, soundPath: null },
      ),
    };
    configRef.current = nextConfig;
    setConfig(nextConfig);
    setConfigDirty(true);
    setOpenMenuPadId(null);
    setSelectorOpen(false);
    setVolumeOpen(false);
    setMenuPosition(null);
    setMessage("Asignaciones liberadas. El inventario de sonidos se conservó.");
  };

  const selectSound = (sound: SoundInventoryItem) => {
    if (selectedPadId === null || selectedPadId === 4 || !sound.soundId || sound.available === false) return;
    updateAssignment(selectedPadId, {
      soundId: sound.soundId,
      soundPath: sound.path,
    });
    setSelectorOpen(false);
    setVolumeOpen(false);
    setSearch("");
  };

  const toggleMenu = (padId: number, event: React.MouseEvent<HTMLButtonElement>) => {
    if (openMenuPadId === padId) {
      setOpenMenuPadId(null);
      setSelectorOpen(false);
      setVolumeOpen(false);
      setMenuPosition(null);
      return;
    }
    menuTriggerRef.current = event.currentTarget;
    setSelectedPadId(padId);
    setOpenMenuPadId(padId);
    setSelectorOpen(false);
    setVolumeOpen(false);
  };

  const activeMenuAssignment = openMenuPadId === null ? null : getAssignment(openMenuPadId);

  return (
    <main className="min-h-screen bg-[#101216] px-3 py-4 text-white sm:px-5 sm:py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <header className="rounded-xl border border-white/10 bg-[#191c22] px-4 py-3 shadow-xl sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300/80">ROCKOMIX</p><span className="text-white/25">/</span><h1 className="text-lg font-black uppercase tracking-[0.14em] text-white/90 sm:text-xl">Virtual Sound Pad</h1></div>
            <p className="mt-1 text-xs text-white/50">CONFIGURACIÓN GENERAL</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
            <Button type="button" size="sm" onClick={() => void loadGeneral()} disabled={isLoading || isSaving || configDirty} title="Volver a cargar el inventario de sonidos">Recargar</Button>
            <Button type="button" size="sm" variant="outline" onClick={releaseAllPads} disabled={isSaving}>Liberar todos</Button>
            <Button type="button" size="sm" onClick={() => void saveConfig()} disabled={isSaving}><Save className="mr-1.5 h-4 w-4" />{isSaving ? "Guardando" : "Guardar"}</Button>
          </div>
        </header>

        <section className="rounded-xl border border-white/10 bg-[#15181d] p-3 shadow-xl sm:p-4">
          <div hidden className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Configurar una sala</p><p className="mt-1 text-xs text-white/35">Una sala nueva recibe una copia independiente de la configuración general.</p></div>
            <div />
          </div>

          <div className="overflow-x-auto pb-1">
          <div className="mx-auto grid w-max grid-cols-[repeat(4,7rem)] grid-rows-4 gap-2">
            {PAD_ROWS.flat().map((padId) => {
              const assignment = getAssignment(padId);
              const sound = resolveSound(assignment);
              const isReserved = padId === 4;
              const isConfigured = Boolean(sound);
              const isPlaying = playingPadId === padId;
              const isPendingResolution = Boolean((assignment.soundId ?? assignment.soundPath) && !sound?.soundId);
              return (
                <div key={padId} className="relative h-28 w-28">
                  <button type="button" disabled={isReserved || !sound || sound.available === false} onClick={() => togglePadPlayback(padId, assignment)} className={`relative flex h-28 w-28 flex-col items-center justify-between rounded-lg border p-2 text-center transition active:scale-[0.98] disabled:cursor-not-allowed ${padColors(padId)} ${isPlaying ? "ring-2 ring-cyan-200 shadow-[0_0_18px_rgba(103,232,249,0.32)]" : ""}`}>
                    <span className="self-start text-[0.7rem] font-semibold tracking-[0.08em] text-white/65">PAD {padId}</span>
                    <span className={`flex flex-1 items-center justify-center text-white/75 ${isPlaying ? "text-cyan-100" : ""}`}>{isReserved ? <Volume2 className="h-6 w-6 text-amber-200/80" /> : isPlaying ? <Square className="h-5 w-5 fill-current" /> : <AudioLines className="h-6 w-6" />}</span>
                    {isReserved ? <span className="w-full text-[0.58rem] leading-tight text-amber-100/85">Reservado para 10 de calificación</span> : <span className={`w-full ${sound ? "line-clamp-2 text-[1rem] font-bold leading-[1.05]" : "text-xs font-medium leading-tight"} text-white/80`}>{isPendingResolution ? "Pendiente de resolución" : sound?.name ?? "Vacío"}</span>}
                    {isConfigured && <Check className="absolute bottom-1.5 left-1.5 h-3.5 w-3.5 text-cyan-200" />}
                  </button>
                  {!isReserved && <button type="button" data-pad-menu-trigger="true" aria-label={`Configurar PAD ${padId}`} onClick={(event) => toggleMenu(padId, event)} className="absolute right-1 top-1 z-10 rounded-md p-1 text-white/60 hover:bg-black/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><MoreVertical className="h-4 w-4" /></button>}
                </div>
              );
            })}
          </div>

          </div>
          {activeMenuAssignment && menuPosition && openMenuPadId !== null && <div ref={menuRef} style={{ top: menuPosition.top, left: menuPosition.left }} className="fixed z-[100] w-56 max-h-[calc(100vh-1rem)] overflow-y-auto rounded-lg border border-white/15 bg-[#11151b]/[0.98] p-1.5 text-left shadow-2xl backdrop-blur-sm animate-in fade-in-0 zoom-in-95">
            <button type="button" onClick={() => { setSelectorOpen(true); setVolumeOpen(false); void scanInventory(); }} disabled={isScanning} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-white/85 hover:bg-white/[0.08] disabled:opacity-50">{isScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-200" /> : <Search className="h-3.5 w-3.5 text-cyan-200" />}{isScanning ? "Escaneando sonidos" : "Cargar / actualizar sonidos"}</button>
            <button type="button" onClick={() => clearAssignment(openMenuPadId)} disabled={openMenuPadId === 4 || (!activeMenuAssignment.soundId && !activeMenuAssignment.soundPath)} title="Liberar la asignación de este PAD" aria-label="Liberar la asignación de este PAD" className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-white/85 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-3.5 w-3.5 text-rose-200" />Liberar</button>
            <button type="button" onClick={() => { setVolumeOpen((current) => !current); setSelectorOpen(false); }} className="mt-1 flex w-full items-center justify-between gap-2 rounded-md border-t border-white/10 px-2.5 py-2 pt-2 text-xs text-white/85 hover:bg-white/[0.08]"><span className="flex items-center gap-2"><Volume2 className="h-3.5 w-3.5 text-cyan-200" />Volumen</span><span>{Math.round(activeMenuAssignment.volume * 100)}%</span></button>
            {volumeOpen && <div className="px-2.5 pb-1"><input aria-label={`Volumen del PAD ${openMenuPadId}`} type="range" min="0" max="1" step="0.01" value={activeMenuAssignment.volume} onChange={(event) => updateAssignment(openMenuPadId, { volume: Number(event.target.value) })} className="w-full accent-cyan-300" /></div>}
            {selectorOpen && <div className="mt-1 border-t border-white/10 pt-2"><div className="relative"><Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-white/35" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar sonido" className="h-8 border-white/10 bg-white/[0.04] pl-8 text-xs text-white placeholder:text-white/30" /></div><div className="mt-1 max-h-48 overflow-y-auto">{filteredSounds.length === 0 ? <p className="p-2 text-xs text-white/45">No hay coincidencias.</p> : filteredSounds.map((soundOption) => { const assignedPath = activeMenuAssignment.soundPath ?? resolveSound(activeMenuAssignment)?.path; const isSelected = soundOption.path === assignedPath; return <div key={soundOption.key} className={`flex items-center gap-1 rounded-md p-1 ${isSelected ? "bg-cyan-300/10" : "hover:bg-white/[0.06]"}`}><button type="button" onClick={() => { selectSound(soundOption); setOpenMenuPadId(null); setMenuPosition(null); }} disabled={!soundOption.soundId || soundOption.available === false} className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-45"><span className="block truncate text-[0.68rem] font-semibold text-white/85">{soundOption.name}{isSelected ? " · asignado" : ""}</span><span className="block truncate text-[0.58rem] text-white/40">{soundOption.origin === "catalog" ? `Catálogo · ID ${soundOption.soundId}` : `Archivo · ${soundOption.folder}${soundOption.soundId ? ` · ID ${soundOption.soundId}` : " · pendiente de registro"}${soundOption.available === false ? " · ausente" : ""}`}</span></button><button type="button" onClick={() => previewAssignment(openMenuPadId, { padId: openMenuPadId, soundId: soundOption.soundId ?? null, soundPath: soundOption.path, volume: activeMenuAssignment.volume })} className="rounded-md p-1 text-white/55 hover:bg-white/10 hover:text-white" aria-label={`Preescuchar ${soundOption.name}`}><Play className="h-3.5 w-3.5" /></button></div>; })}</div></div>}
          </div>}
        </section>

        <div className="min-h-5 text-center text-xs text-white/60" role="status">{message}</div>
        <p className="text-center text-[0.68rem] text-white/30">Administración sin autenticación en esta etapa. El reproductor de pruebas es local y no envía mensajes a HOST.</p>
      </div>
    </main>
  );
}
