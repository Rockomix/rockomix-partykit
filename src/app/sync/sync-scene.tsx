"use client";

import YouTube from "react-youtube";
import Image from "next/image";
import usePartySocket from "partysocket/react";
import { useEffect, useRef, useState } from "react";
import { env } from "~/env";
import { APP_TEXT_BRAND } from "~/constants/app";
import { LogoBrand } from "~/components/logo-brand";
import { Input } from "~/components/ui/ui/input";
import { ButtonHoverGradient } from "~/components/ui/ui/button-hover-gradient";
import { api } from "~/trpc/react";
import { recordDiagnostic } from "~/lib/diagnostics";

type SyncState = {
  videoId: string;
  position: number;
  isPlaying: boolean;
  serverTimestamp: number;
};

type SyncYouTubePlayer = {
  getCurrentTime: () => number | Promise<number>;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void | Promise<void>;
  playVideo: () => void | Promise<void>;
  pauseVideo: () => void | Promise<void>;
  setPlaybackRate?: (playbackRate: number) => void;
  getAvailablePlaybackRates?: () => number[];
  getPlaybackRate?: () => number;
};

type ReadyEvent = { target: SyncYouTubePlayer };

type SyncDiagContext = Record<string, unknown>;

function syncDiagError(error: unknown) {
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack,
    };
  }

  return {
    errorMessage: String(error),
    errorName: typeof error,
    errorStack: undefined,
  };
}

function syncDiagLog(event: string, context: SyncDiagContext = {}) {
  recordDiagnostic({
    event: `sync.${event}`,
    level: event.includes("ERROR") || event.includes("REJECTED") ? "error" : "info",
    component: "SyncScene",
    context,
  });
}

function syncDiagCall<T>(
  operation: string,
  call: () => T,
  context: () => SyncDiagContext,
  options: {
    logStart?: boolean;
    logResolved?: boolean;
  } = {},
) {
  if (options.logStart !== false) {
    syncDiagLog(`youtube ${operation} START`, context());
  }

  try {
    const result = call();

    if (
      result !== null &&
      typeof result === "object" &&
      "then" in result &&
      typeof result.then === "function"
    ) {
      void Promise.resolve(result).then(
        () => {
          if (options.logResolved !== false) {
            syncDiagLog(`youtube ${operation} RESOLVED`, context());
          }
        },
        (error: unknown) => {
          syncDiagLog(`youtube ${operation} REJECTED`, {
            ...context(),
            ...syncDiagError(error),
          });
        },
      );
    } else {
      if (options.logResolved !== false) {
        syncDiagLog(`youtube ${operation} RESOLVED`, {
          ...context(),
          result,
        });
      }
    }

    return result;
  } catch (error) {
    syncDiagLog(`youtube ${operation} REJECTED`, {
      ...context(),
      ...syncDiagError(error),
    });
    throw error;
  }
}

// SINGER_SYNC: mismo video institucional utilizado por PlayerScene normal.
const INSTITUTIONAL_VIDEO_ID = "oL1w1Xv9f7A";

type PlaylistVideo = {
  id: string;
  playedAt: Date | string | null;
};

type ClockCalibrationSample = {
  clientSentAt: number;
  serverTimestamp: number;
  clientReceivedAt: number;
  rttMs: number;
  clockOffsetMs: number;
};

const CLOCK_CALIBRATION_SAMPLE_COUNT = 8;
const CLOCK_CALIBRATION_INTERVAL_MS = 100;
const DRIFT_TOLERANCE_MS = 40;
const DRIFT_EXIT_MS = 30;
const HARD_SEEK_THRESHOLD_MS = 1000;
const HARD_SEEK_RETRY_DELAY_MS = 1000;
const SOFT_RATE_DELTA = 0.02;

function selectSupportedPlaybackRate(
  availableRates: number[],
  targetRate: number,
) {
  const rates = [...new Set(availableRates)]
    .filter((rate) => Number.isFinite(rate))
    .sort((left, right) => left - right);

  if (rates.includes(targetRate)) return targetRate;

  if (targetRate > 1) {
    return rates.find((rate) => rate > 1) ?? null;
  }

  return [...rates].reverse().find((rate) => rate < 1) ?? null;
}

function formatTime(seconds: number) {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const minutes = Math.floor(totalMs / 60_000);
  const remainder = totalMs % 60_000;
  return `${String(minutes).padStart(2, "0")}:${(remainder / 1000).toFixed(3).padStart(6, "0")}`;
}

function applyPlaybackState(
  player: SyncYouTubePlayer,
  state: SyncState,
  clockOffsetMs: number,
  diagContext: () => SyncDiagContext,
) {
  const correctedNow = Date.now() - clockOffsetMs;
  const expectedPosition =
    state.position +
    (state.isPlaying
      ? (correctedNow - state.serverTimestamp) / 1000
      : 0);
  syncDiagCall(
    "setPlaybackRate",
    () => player.setPlaybackRate?.(1),
    diagContext,
  );
  void syncDiagCall(
    "seekTo",
    () => player.seekTo(expectedPosition, true),
    diagContext,
  );
  if (state.isPlaying) {
    void syncDiagCall(
      "playVideo",
      () => player.playVideo(),
      diagContext,
    );
  } else {
    void syncDiagCall(
      "pauseVideo",
      () => player.pauseVideo(),
      diagContext,
    );
  }
}

export default function SyncScene() {
  const [roomInput, setRoomInput] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const partyQuery = api.party.getByHash.useQuery(
    { hash: roomId ?? "" },
    { enabled: roomId !== null },
  );

  const connect = (event: React.FormEvent) => {
    event.preventDefault();
    const hash = roomInput.trim();
    if (hash) setRoomId(hash);
  };

  if (!roomId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center text-white">
        <div className="hero min-h-screen bg-base-200">
          <div className="hero-content text-center">
            <div className="max-w-xl p-5">
              <LogoBrand size="lg" />
              <form
                onSubmit={connect}
                className="mt-6 flex flex-col space-y-4 text-left"
              >
                <label htmlFor="room" className="text-sm font-medium text-white/80">
                  ID de sala
                </label>
                <Input
                  id="room"
                  value={roomInput}
                  onChange={(event) => setRoomInput(event.target.value)}
                  placeholder="Escribe el ID de la sala"
                  className="input input-bordered w-full"
                  autoComplete="off"
                />
                <ButtonHoverGradient type="submit">CONECTAR</ButtonHoverGradient>
              </form>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden px-4 py-5 text-white sm:px-6 sm:py-7">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 sm:gap-8">
          <header className="flex flex-col items-center justify-center border-b border-white/10 pb-4 text-center sm:pb-5">
            <div className="flex max-w-full items-center gap-3">
              <Image
                src="/android-chrome-192x192.png"
                alt={APP_TEXT_BRAND.name}
                width={56}
                height={56}
                priority
                className="h-14 w-14 shrink-0 object-contain"
              />
              <div className="min-w-0 text-left">
                <p className="truncate text-base font-semibold tracking-wide text-white/90">
                  {APP_TEXT_BRAND.name}
                </p>
                <p className="mt-1 truncate text-sm italic font-medium leading-none text-white/75">
                  {APP_TEXT_BRAND.subtitle}
                </p>
              </div>
            </div>
            {partyQuery.data?.name ? (
              <p className="mt-4 text-lg font-extrabold tracking-tight text-white sm:text-xl">
                Fiesta de {partyQuery.data.name}
              </p>
            ) : null}
          <div className="hidden">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary-foreground/60">
              {APP_TEXT_BRAND.name}
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Sincronización en tiempo real
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/65 sm:ml-auto sm:text-base">
              Conecta este reproductor a una sala activa y acompaña el compás de la fiesta.
            </p>
          </div>
        </header>

        {!roomId ? (
          <section className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-black/20 p-4 shadow-xl backdrop-blur sm:p-5">
            <div className="hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/65">
                Laboratorio de reproducción
              </p>
              <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
                Conecta tu reproductor
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Introduce el hash de una sala existente para observar su reproducción sincronizada.
              </p>
            </div>
            <form onSubmit={connect} className="flex w-full flex-col gap-3">
              <label htmlFor="room" className="text-sm font-medium text-white/80">
                ID de sala
              </label>
              <input
                id="room"
                value={roomInput}
                onChange={(event) => setRoomInput(event.target.value)}
                className="h-12 w-full rounded-xl border border-white/15 bg-white/95 px-4 text-base text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                placeholder="Escribe el ID de la sala"
                autoComplete="off"
              />
              <button
                type="submit"
                className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]"
              >
                Conectar
              </button>
            </form>
          </section>
        ) : (
          <ConnectedSyncRoom roomId={roomId} />
        )}
      </div>
    </main>
  );
}

function ConnectedSyncRoom({ roomId }: { roomId: string }) {
  const [connected, setConnected] = useState(false);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  // SINGER_SYNC: conserva el video detectado por playlist mientras llega la referencia temporal.
  const [preparedVideoId, setPreparedVideoId] = useState<string | null>(null);
  const [actualPosition, setActualPosition] = useState(0);
  const [expectedPosition, setExpectedPosition] = useState(0);
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [clockOffsetReady, setClockOffsetReady] = useState(false);
  const playerRef = useRef<SyncYouTubePlayer | null>(null);
  const playerReadyVideoIdRef = useRef<string | null>(null);
  const clockOffsetMsRef = useRef(0);
  const clockCalibrationSamplesRef = useRef<ClockCalibrationSample[]>([]);
  const pendingPingTimestampsRef = useRef(new Set<number>());
  const clockCalibrationTimerRef = useRef<number | null>(null);
  const clockCalibrationActiveRef = useRef(false);
  const driftCorrectionModeRef = useRef<"idle" | "soft" | "hard-seek">("idle");
  const hardSeekInFlightRef = useRef(false);
  const hardSeekNextAttemptAtRef = useRef(0);
  const heartbeatPingTimestampsRef = useRef(new Set<number>());
  const requestedPlaybackRateRef = useRef(1);
  const appliedPlaybackRateRef = useRef<number | null>(1);
  const availablePlaybackRatesRef = useRef<number[]>([1]);
  const appliedVideoIdRef = useRef<string | null>(null);
  // SINGER_SYNC: la recomposicion se ejecuta una sola vez por cancion.
  const recompositionDoneRef = useRef(false);
  const recompositionTimerRef = useRef<number | null>(null);
  const syncStateRef = useRef<SyncState | null>(null);
  const currentPlaylistVideoIdRef = useRef<string | null>(null);
  const driftDiagTickRef = useRef(0);

  const getSyncDiagContext = (videoId?: string): SyncDiagContext => ({
    videoId: videoId ?? syncStateRef.current?.videoId ?? preparedVideoId,
    syncStateVideoId: syncStateRef.current?.videoId,
    connected,
    clockOffsetReady,
    playerReadyVideoId: playerReadyVideoIdRef.current,
    socketReadyState: socket.readyState,
  });

  useEffect(() => {
    syncStateRef.current = syncState;
  }, [syncState]);

  const socket = usePartySocket({
    host: env.NEXT_PUBLIC_PARTYKIT_URL,
    room: roomId,
    query: { role: "guest" },
    onOpen() {
      syncDiagLog("socket OPEN", {
        socketReadyState: socket.readyState,
        videoId: syncStateRef.current?.videoId ?? preparedVideoId,
        connected,
        syncStateVideoId: syncStateRef.current?.videoId,
      });
      if (clockCalibrationTimerRef.current !== null) {
        window.clearInterval(clockCalibrationTimerRef.current);
        clockCalibrationTimerRef.current = null;
      }
      clockCalibrationSamplesRef.current = [];
      pendingPingTimestampsRef.current.clear();
      heartbeatPingTimestampsRef.current.clear();
      clockCalibrationActiveRef.current = false;
      clockOffsetMsRef.current = 0;
      setClockOffsetReady(false);
      setRttMs(null);
      setConnected(true);
    },
    onClose() {
      syncDiagLog("socket CLOSE", {
        socketReadyState: socket.readyState,
        videoId: syncStateRef.current?.videoId ?? preparedVideoId,
        connected,
        syncStateVideoId: syncStateRef.current?.videoId,
      });
      setConnected(false);
    },
    onError(error) {
      const socketError = error as unknown as {
        message?: unknown;
        error?: unknown;
      };
      const errorDetails = syncDiagError(socketError.error ?? error);
      syncDiagLog("socket ERROR", {
        socketReadyState: socket.readyState,
        videoId: syncStateRef.current?.videoId ?? preparedVideoId,
        connected,
        syncStateVideoId: syncStateRef.current?.videoId,
        ...errorDetails,
      });
    },
    onMessage(event) {
      const parsed = JSON.parse(event.data as string) as unknown;
      const message = parsed as Partial<SyncState> & {
        type?: string;
        clientSentAt?: number;
        playlist?: PlaylistVideo[];
      };
      const playlist = Array.isArray(parsed)
        ? parsed
        : message.type === "connected" && Array.isArray(message.playlist)
          ? message.playlist
          : null;

      // SINGER_SYNC: reutiliza el broadcast normal de playlist para detectar NEXT.
      if (playlist) {
        const currentVideo = (playlist as PlaylistVideo[]).find(
          (video) => !video.playedAt,
        );
        currentPlaylistVideoIdRef.current =
          currentVideo?.id ?? INSTITUTIONAL_VIDEO_ID;

        // SINGER_SYNC: replica el estado de espera del player normal cuando no hay cancion.
        if (!currentVideo) {
          if (
            syncStateRef.current?.videoId !== INSTITUTIONAL_VIDEO_ID ||
            preparedVideoId !== INSTITUTIONAL_VIDEO_ID
          ) {
            setPreparedVideoId(INSTITUTIONAL_VIDEO_ID);
            setSyncState(null);
            recompositionDoneRef.current = false;
            appliedVideoIdRef.current = null;
          }

          return;
        }

        if (
          currentVideo &&
          currentVideo.id !== syncStateRef.current?.videoId &&
          currentVideo.id !== preparedVideoId
        ) {
          setPreparedVideoId(currentVideo.id);
          setSyncState(null);
          recompositionDoneRef.current = false;
          appliedVideoIdRef.current = null;
        }

        return;
      }

      if (message.type === "sync-state" && message.videoId && typeof message.serverTimestamp === "number") {
        if (currentPlaylistVideoIdRef.current !== message.videoId) {
          return;
        }

        setSyncState({
          videoId: message.videoId,
          position: message.position ?? 0,
          isPlaying: message.isPlaying ?? false,
          serverTimestamp: message.serverTimestamp,
        });
        setPreparedVideoId(message.videoId);
      }

      if (
        message.type === "sync-pong" &&
        typeof message.clientSentAt === "number" &&
        typeof message.serverTimestamp === "number"
      ) {
        const calibrationPing = pendingPingTimestampsRef.current.has(
          message.clientSentAt,
        );
        const heartbeatPing = heartbeatPingTimestampsRef.current.has(
          message.clientSentAt,
        );
        syncDiagLog("sync-pong RECEIVED", {
          ...getSyncDiagContext(message.videoId),
          clientSentAt: message.clientSentAt,
          serverTimestamp: message.serverTimestamp,
          mode: calibrationPing
            ? "CALIBRATION"
            : heartbeatPing
              ? "HEARTBEAT"
              : "UNKNOWN",
        });
        heartbeatPingTimestampsRef.current.delete(message.clientSentAt);
        if (
          !clockCalibrationActiveRef.current ||
          !pendingPingTimestampsRef.current.has(message.clientSentAt)
        ) {
          return;
        }

        const clientReceivedAt = Date.now();
        pendingPingTimestampsRef.current.delete(message.clientSentAt);
        const rttMs = clientReceivedAt - message.clientSentAt;
        const estimatedClientTimeAtServerReceive =
          message.clientSentAt + rttMs / 2;
        // clockOffsetMs = reloj del cliente - reloj del servidor.
        const clockOffsetMs =
          estimatedClientTimeAtServerReceive - message.serverTimestamp;

        clockCalibrationSamplesRef.current.push({
          clientSentAt: message.clientSentAt,
          serverTimestamp: message.serverTimestamp,
          clientReceivedAt,
          rttMs,
          clockOffsetMs,
        });

        if (
          clockCalibrationSamplesRef.current.length >=
          CLOCK_CALIBRATION_SAMPLE_COUNT
        ) {
          const selectedSample = [...clockCalibrationSamplesRef.current].sort(
            (left, right) => left.rttMs - right.rttMs,
          )[0];
          if (!selectedSample) return;
          clockOffsetMsRef.current = selectedSample.clockOffsetMs;
          setRttMs(selectedSample.rttMs);
          setClockOffsetReady(true);
          clockCalibrationActiveRef.current = false;
          if (clockCalibrationTimerRef.current !== null) {
            window.clearInterval(clockCalibrationTimerRef.current);
            clockCalibrationTimerRef.current = null;
          }
        }
      }
    },
  });

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      const windowError = event as unknown as { error?: unknown };
      syncDiagLog("GLOBAL error", {
        ...getSyncDiagContext(),
        ...syncDiagError(windowError.error ?? event),
        eventMessage: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      syncDiagLog("GLOBAL unhandledrejection", {
        ...getSyncDiagContext(),
        ...syncDiagError(event.reason),
      });
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  });

  useEffect(() => {
    if (!connected) return;

    const sendCalibrationPing = () => {
      if (socket.readyState === WebSocket.OPEN) {
        const clientSentAt = Date.now();
        pendingPingTimestampsRef.current.add(clientSentAt);
        syncDiagLog("sync-ping SEND", {
          ...getSyncDiagContext(),
          mode: "CALIBRATION",
          clientSentAt,
        });
        socket.send(JSON.stringify({ type: "sync-ping", clientSentAt }));
      }
    };

    clockCalibrationSamplesRef.current = [];
    pendingPingTimestampsRef.current.clear();
    clockCalibrationActiveRef.current = true;
    sendCalibrationPing();
    clockCalibrationTimerRef.current = window.setInterval(
      sendCalibrationPing,
      CLOCK_CALIBRATION_INTERVAL_MS,
    );

    return () => {
      clockCalibrationActiveRef.current = false;
      if (clockCalibrationTimerRef.current !== null) {
        window.clearInterval(clockCalibrationTimerRef.current);
        clockCalibrationTimerRef.current = null;
      }
    };
  }, [socket, connected]);

  useEffect(() => {
    if (!connected || !clockOffsetReady) return;

    const sendHeartbeatPing = () => {
      if (socket.readyState === WebSocket.OPEN) {
        const clientSentAt = Date.now();
        heartbeatPingTimestampsRef.current.add(clientSentAt);
        syncDiagLog("heartbeat SEND", {
          ...getSyncDiagContext(),
          mode: "HEARTBEAT",
          clientSentAt,
        });
        socket.send(JSON.stringify({ type: "sync-ping", clientSentAt }));
      }
    };

    const interval = window.setInterval(sendHeartbeatPing, 30_000);
    return () => window.clearInterval(interval);
  }, [socket, connected, clockOffsetReady]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!syncState || !clockOffsetReady) return;
      const correctedNow = Date.now() - clockOffsetMsRef.current;
      const elapsed = (correctedNow - syncState.serverTimestamp) / 1000;
      const expected =
        syncState.position +
        (syncState.isPlaying ? elapsed : 0);
      setExpectedPosition(expected);

      const player = playerRef.current;
      if (
        !player ||
        playerReadyVideoIdRef.current !== syncState.videoId
      ) {
        return;
      }

      driftDiagTickRef.current += 1;
      const shouldLogDriftStart = driftDiagTickRef.current % 40 === 0;
      if (shouldLogDriftStart) {
        syncDiagLog("drift getCurrentTime START", {
          ...getSyncDiagContext(syncState.videoId),
          expectedPosition: expected,
          isPlaying: syncState.isPlaying,
        });
      }

      let currentTime: number | Promise<number>;
      try {
        currentTime = syncDiagCall(
          "drift getCurrentTime",
          () => player.getCurrentTime(),
          () => ({
            ...getSyncDiagContext(syncState.videoId),
            expectedPosition: expected,
            isPlaying: syncState.isPlaying,
          }),
          { logStart: false, logResolved: false },
        );
      } catch (error) {
        syncDiagLog("drift getCurrentTime REJECTED", {
          ...getSyncDiagContext(syncState.videoId),
          expectedPosition: expected,
          isPlaying: syncState.isPlaying,
          ...syncDiagError(error),
        });
        return;
      }
      const processPosition = (position: number) => {
        setActualPosition(position);

        const setPlaybackRate = (requestedRate: number) => {
          if (requestedPlaybackRateRef.current === requestedRate) {
            return appliedPlaybackRateRef.current === requestedRate;
          }

          requestedPlaybackRateRef.current = requestedRate;
          if (!player.setPlaybackRate) {
            appliedPlaybackRateRef.current = null;
            return false;
          }

          syncDiagCall(
            "setPlaybackRate",
            () => player.setPlaybackRate?.(requestedRate),
            () => getSyncDiagContext(syncState.videoId),
          );
          const effectiveRate = syncDiagCall(
            "getPlaybackRate",
            () => player.getPlaybackRate?.(),
            () => getSyncDiagContext(syncState.videoId),
          );
          appliedPlaybackRateRef.current =
            typeof effectiveRate === "number" ? effectiveRate : null;
          return appliedPlaybackRateRef.current === requestedRate;
        };

        if (!syncState.isPlaying) {
          setPlaybackRate(1);
          driftCorrectionModeRef.current = "idle";
          return;
        }

        const driftMs = Math.round((position - expected) * 1000);
        const absoluteDriftMs = Math.abs(driftMs);

        if (absoluteDriftMs >= HARD_SEEK_THRESHOLD_MS) {
          const now = Date.now();
          if (
            !hardSeekInFlightRef.current &&
            now >= hardSeekNextAttemptAtRef.current
          ) {
            driftCorrectionModeRef.current = "hard-seek";
            hardSeekInFlightRef.current = true;
            hardSeekNextAttemptAtRef.current =
              now + HARD_SEEK_RETRY_DELAY_MS;
            setPlaybackRate(1);

            try {
              const seekResult = syncDiagCall(
                "seekTo",
                () => player.seekTo(expected, true),
                () => getSyncDiagContext(syncState.videoId),
              );
              void Promise.resolve(seekResult)
                .then(() => {
                  if (syncState.isPlaying) {
                    void syncDiagCall(
                      "playVideo",
                      () => player.playVideo(),
                      () => getSyncDiagContext(syncState.videoId),
                    );
                  } else {
                    void syncDiagCall(
                      "pauseVideo",
                      () => player.pauseVideo(),
                      () => getSyncDiagContext(syncState.videoId),
                    );
                  }
                })
                .catch(() => undefined)
                .finally(() => {
                  hardSeekInFlightRef.current = false;
                });
            } catch {
              hardSeekInFlightRef.current = false;
            }
          }
          return;
        }

        if (driftCorrectionModeRef.current === "hard-seek") {
          if (absoluteDriftMs < DRIFT_EXIT_MS) {
            driftCorrectionModeRef.current = "idle";
          } else if (absoluteDriftMs < HARD_SEEK_THRESHOLD_MS) {
            driftCorrectionModeRef.current = "soft";
          } else {
            return;
          }
        }

        if (
          driftCorrectionModeRef.current === "soft" &&
          absoluteDriftMs < DRIFT_EXIT_MS
        ) {
          setPlaybackRate(1);
          driftCorrectionModeRef.current = "idle";
          return;
        }

        if (absoluteDriftMs < DRIFT_TOLERANCE_MS) return;

        const requestedRate =
          driftMs < 0 ? 1 + SOFT_RATE_DELTA : 1 - SOFT_RATE_DELTA;
        const targetRate = selectSupportedPlaybackRate(
          availablePlaybackRatesRef.current,
          requestedRate,
        );
        setPlaybackRate(targetRate ?? 1);
        driftCorrectionModeRef.current = "soft";
      };

      if (currentTime instanceof Promise) {
        void currentTime.then(
          (position) => {
            if (shouldLogDriftStart) {
              syncDiagLog("drift getCurrentTime RESOLVED", {
                ...getSyncDiagContext(syncState.videoId),
                position,
              });
            }
            processPosition(position);
          },
          (error: unknown) => {
            syncDiagLog("drift getCurrentTime REJECTED", {
              ...getSyncDiagContext(syncState.videoId),
              expectedPosition: expected,
              isPlaying: syncState.isPlaying,
              ...syncDiagError(error),
            });
          },
        );
      } else {
        if (shouldLogDriftStart) {
          syncDiagLog("drift getCurrentTime RESOLVED", {
            ...getSyncDiagContext(syncState.videoId),
            position: currentTime,
          });
        }
        processPosition(currentTime);
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [syncState, clockOffsetReady]);

  // SINGER_SYNC: una nueva cancion inicia una nueva oportunidad de recomposicion.
  useEffect(() => {
    recompositionDoneRef.current = false;
    driftCorrectionModeRef.current = "idle";
    hardSeekInFlightRef.current = false;
    hardSeekNextAttemptAtRef.current = 0;
    requestedPlaybackRateRef.current = 1;
    appliedPlaybackRateRef.current = 1;
    availablePlaybackRatesRef.current = [1];
    if (recompositionTimerRef.current !== null) {
      window.clearInterval(recompositionTimerRef.current);
      recompositionTimerRef.current = null;
    }

    return () => {
      if (recompositionTimerRef.current !== null) {
        window.clearInterval(recompositionTimerRef.current);
        recompositionTimerRef.current = null;
      }
    };
  }, [syncState?.videoId]);

  // SINGER_SYNC: espera a que getCurrentTime() demuestre avance real.
  const handleSyncPlay = () => {
    if (recompositionDoneRef.current || recompositionTimerRef.current !== null) {
      return;
    }

    const state = syncStateRef.current;
    const player = playerRef.current;
    if (!state || !player) return;

    let previousPosition: number | null = null;
    let readInProgress = false;

    const readPosition = (onRead: (actualPosition: number) => void) => {
      const currentTime = syncDiagCall(
        "recomposition getCurrentTime",
        () => player.getCurrentTime(),
        () => getSyncDiagContext(state.videoId),
        { logStart: false, logResolved: false },
      );
      if (currentTime instanceof Promise) {
        void currentTime.then(onRead, (error: unknown) => {
          syncDiagLog("recomposition getCurrentTime REJECTED", {
            ...getSyncDiagContext(state.videoId),
            ...syncDiagError(error),
          });
        });
      } else {
        onRead(currentTime);
      }
    };

    const detectPlaybackAdvance = () => {
      if (readInProgress || recompositionDoneRef.current) return;
      readInProgress = true;

      readPosition((currentPosition) => {
        readInProgress = false;

        if (previousPosition === null) {
          previousPosition = currentPosition;
          return;
        }

        if (currentPosition <= previousPosition) {
          previousPosition = currentPosition;
          return;
        }

        const correctedNow = Date.now() - clockOffsetMsRef.current;
        const expectedPosition =
          state.position +
          (state.isPlaying
            ? (correctedNow - state.serverTimestamp) / 1000
            : 0);
        setExpectedPosition(expectedPosition);
        setActualPosition(currentPosition);
        recompositionDoneRef.current = true;
        if (recompositionTimerRef.current !== null) {
          window.clearInterval(recompositionTimerRef.current);
          recompositionTimerRef.current = null;
        }

        // SINGER_SYNC: una sola correccion; no hay segunda recomposicion ni playbackRate.
        void Promise.resolve(
          syncDiagCall(
            "recomposition seekTo",
            () => player.seekTo(expectedPosition, true),
            () => getSyncDiagContext(state.videoId),
          ),
        ).then(() => {
          // SINGER_SYNC: no se realiza ninguna correccion posterior.
        });
      });
    };

    // SINGER_SYNC: el intervalo solo observa avance; no asume estabilidad por tiempo fijo.
    detectPlaybackAdvance();
    if (recompositionDoneRef.current) return;
    recompositionTimerRef.current = window.setInterval(
      detectPlaybackAdvance,
      100,
    );
  };

  useEffect(() => {
    if (
      !syncState ||
      !clockOffsetReady ||
      !playerRef.current ||
      playerReadyVideoIdRef.current !== syncState.videoId
    ) {
      return;
    }
    if (appliedVideoIdRef.current !== syncState.videoId) {
      applyPlaybackState(
        playerRef.current,
        syncState,
        clockOffsetMsRef.current,
        () => getSyncDiagContext(syncState.videoId),
      );
      appliedVideoIdRef.current = syncState.videoId;
    } else if (syncState.isPlaying) {
      void syncDiagCall(
        "playVideo",
        () => playerRef.current!.playVideo(),
        () => getSyncDiagContext(syncState.videoId),
      );
    } else {
      syncDiagCall(
        "setPlaybackRate",
        () => playerRef.current!.setPlaybackRate?.(1),
        () => getSyncDiagContext(syncState.videoId),
      );
      requestedPlaybackRateRef.current = 1;
      appliedPlaybackRateRef.current = 1;
      driftCorrectionModeRef.current = "idle";
      void syncDiagCall(
        "pauseVideo",
        () => playerRef.current!.pauseVideo(),
        () => getSyncDiagContext(syncState.videoId),
      );
    }
  }, [syncState, clockOffsetReady]);

  const driftMs = Math.round((actualPosition - expectedPosition) * 1000);
  const renderedVideoId = syncState?.videoId ?? preparedVideoId ?? "sync";
  const canRenderPlayer =
    preparedVideoId === INSTITUTIONAL_VIDEO_ID ||
    (clockOffsetReady && syncState !== null);
  const clockOffsetLabel = clockOffsetReady
    ? `${Math.round(clockOffsetMsRef.current)} ms`
    : "—";

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4 sm:gap-5">
      <header className="hidden">
        <div className="hidden">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/60">Sala {roomId}</p>
          <h2 className="mt-1 truncate text-xl font-bold sm:text-2xl">{syncState ? "Reproducción sincronizada" : "Preparando la sala"}</h2>
          <p className="mt-1 truncate text-sm text-white/60">{syncState?.videoId ?? preparedVideoId ?? "Esperando una referencia de reproducción"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white/80">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-400"}`} aria-hidden="true" />
            {connected ? "Conectado" : "Desconectado"}
          </span>
          <span className="rounded-full border border-primary/30 bg-primary/15 px-3 py-2 text-primary-foreground">{syncState?.isPlaying ? "Playing" : "Paused"}</span>
        </div>
      </header>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="mx-auto min-w-0 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-2 shadow-2xl sm:p-3">
          <div className="hidden">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Reproductor</p>
              <p className="mt-1 text-sm text-white/75">Copia local de la sala</p>
            </div>
            <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/60">SINGER_SYNC</span>
          </div>
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
            {canRenderPlayer ? (
              <YouTube
                key={renderedVideoId}
                videoId={syncState?.videoId ?? preparedVideoId ?? undefined}
                className="h-full w-full"
                iframeClassName="h-full w-full border-0"
                style={{ height: "100%", width: "100%" }}
                opts={{
                  playerVars: {
                    autoplay: preparedVideoId === INSTITUTIONAL_VIDEO_ID ? 1 : 0,
                    controls: 1,
                    rel: 0,
                    ...(preparedVideoId === INSTITUTIONAL_VIDEO_ID
                      ? { loop: 1, playlist: INSTITUTIONAL_VIDEO_ID }
                      : {}),
                  },
                }}
                onPlay={handleSyncPlay}
                onReady={(event: ReadyEvent) => {
                  const player = event.target;
                  if (!player) return;
                  playerRef.current = player;
                  const availableRates = syncDiagCall(
                    "getAvailablePlaybackRates",
                    () => player.getAvailablePlaybackRates?.(),
                    () => getSyncDiagContext(syncState?.videoId ?? preparedVideoId ?? undefined),
                  );
                  availablePlaybackRatesRef.current =
                    availableRates && availableRates.length > 0
                      ? availableRates
                      : [1];
                  requestedPlaybackRateRef.current = 1;
                  const effectiveRate = syncDiagCall(
                    "getPlaybackRate",
                    () => player.getPlaybackRate?.(),
                    () => getSyncDiagContext(playerReadyVideoIdRef.current ?? undefined),
                  );
                  appliedPlaybackRateRef.current =
                    typeof effectiveRate === "number" ? effectiveRate : 1;
                  playerReadyVideoIdRef.current =
                    syncState?.videoId ?? preparedVideoId;
                  if (syncState && clockOffsetReady) {
                    applyPlaybackState(
                      player,
                      syncState,
                      clockOffsetMsRef.current,
                      () => getSyncDiagContext(syncState.videoId),
                    );
                  }
                  // SINGER_SYNC: si aun no existe referencia temporal, forzar apply al recibirla.
                  appliedVideoIdRef.current = syncState?.videoId ?? null;
                }}
              />
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold uppercase tracking-wide text-white/70">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-400"}`} aria-hidden="true" />
            {connected ? "Conectado" : "Desconectado"}
          </span>
          <span className="text-primary-foreground/85">
            {syncState?.isPlaying ? "Playing" : "Paused"}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
          <div className="hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">CURRENT</p>
            <p className="mt-2 break-all text-sm font-semibold text-white/90">{syncState?.videoId ?? preparedVideoId ?? "—"}</p>
          </div>
          <div className="flex items-baseline gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">EXPECTED</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-white">{formatTime(expectedPosition)}</p>
          </div>
          <div className="flex items-baseline gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">REAL</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-white">{formatTime(actualPosition)}</p>
          </div>
          <div className="flex items-baseline gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground/70">DRIFT</p>
            <p className="font-mono text-sm font-bold tabular-nums text-primary-foreground">{syncState ? `${driftMs} ms` : "—"}</p>
          </div>
          <div className="flex items-baseline gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">RTT</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-white">{rttMs === null ? "—" : `${rttMs} ms`}</p>
          </div>
          <div className="flex items-baseline gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">OFFSET</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-white">{clockOffsetLabel}</p>
          </div>
        </div>
      </div>
      <div className="sr-only">Estado: {syncState?.isPlaying ? "PLAYING" : "PAUSED"}</div>
    </section>
  );
}
