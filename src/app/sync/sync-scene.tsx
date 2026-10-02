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
) {
  const correctedNow = Date.now() - clockOffsetMs;
  const expectedPosition =
    state.position +
    (state.isPlaying
      ? (correctedNow - state.serverTimestamp) / 1000
      : 0);
  player.setPlaybackRate?.(1);
  void player.seekTo(expectedPosition, true);
  if (state.isPlaying) void player.playVideo();
  else void player.pauseVideo();
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
  const requestedPlaybackRateRef = useRef(1);
  const appliedPlaybackRateRef = useRef<number | null>(1);
  const availablePlaybackRatesRef = useRef<number[]>([1]);
  const appliedVideoIdRef = useRef<string | null>(null);
  // SINGER_SYNC: la recomposicion se ejecuta una sola vez por cancion.
  const recompositionDoneRef = useRef(false);
  const recompositionTimerRef = useRef<number | null>(null);
  const syncStateRef = useRef<SyncState | null>(null);
  const currentPlaylistVideoIdRef = useRef<string | null>(null);

  useEffect(() => {
    syncStateRef.current = syncState;
  }, [syncState]);

  const socket = usePartySocket({
    host: env.NEXT_PUBLIC_PARTYKIT_URL,
    room: roomId,
    query: { role: "guest" },
    onOpen() {
      if (clockCalibrationTimerRef.current !== null) {
        window.clearInterval(clockCalibrationTimerRef.current);
        clockCalibrationTimerRef.current = null;
      }
      clockCalibrationSamplesRef.current = [];
      pendingPingTimestampsRef.current.clear();
      clockCalibrationActiveRef.current = false;
      clockOffsetMsRef.current = 0;
      setClockOffsetReady(false);
      setRttMs(null);
      setConnected(true);
    },
    onClose() {
      setConnected(false);
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
    if (!connected) return;

    const sendCalibrationPing = () => {
      if (socket.readyState === WebSocket.OPEN) {
        const clientSentAt = Date.now();
        pendingPingTimestampsRef.current.add(clientSentAt);
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
        socket.send(JSON.stringify({ type: "sync-ping", clientSentAt: Date.now() }));
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

      const currentTime = player.getCurrentTime();
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

          player.setPlaybackRate(requestedRate);
          const effectiveRate = player.getPlaybackRate?.();
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
              const seekResult = player.seekTo(expected, true);
              void Promise.resolve(seekResult)
                .then(() => {
                  if (syncState.isPlaying) void player.playVideo();
                  else void player.pauseVideo();
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
        void currentTime.then(processPosition);
      } else {
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
      const currentTime = player.getCurrentTime();
      if (currentTime instanceof Promise) {
        void currentTime.then(onRead);
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
        void Promise.resolve(player.seekTo(expectedPosition, true)).then(() => {
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
      applyPlaybackState(playerRef.current, syncState, clockOffsetMsRef.current);
      appliedVideoIdRef.current = syncState.videoId;
    } else if (syncState.isPlaying) {
      void playerRef.current.playVideo();
    } else {
      playerRef.current.setPlaybackRate?.(1);
      requestedPlaybackRateRef.current = 1;
      appliedPlaybackRateRef.current = 1;
      driftCorrectionModeRef.current = "idle";
      void playerRef.current.pauseVideo();
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
                  const availableRates = player.getAvailablePlaybackRates?.();
                  availablePlaybackRatesRef.current =
                    availableRates && availableRates.length > 0
                      ? availableRates
                      : [1];
                  requestedPlaybackRateRef.current = 1;
                  const effectiveRate = player.getPlaybackRate?.();
                  appliedPlaybackRateRef.current =
                    typeof effectiveRate === "number" ? effectiveRate : 1;
                  playerReadyVideoIdRef.current =
                    syncState?.videoId ?? preparedVideoId;
                  if (syncState && clockOffsetReady) {
                    applyPlaybackState(player, syncState, clockOffsetMsRef.current);
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
