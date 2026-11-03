/* eslint-disable */
"use client";

import {
  readLocalStorageValue,
  useFullscreen,
  useHotkeys,
} from "@mantine/hooks";
import type { Party } from "@prisma/client";
import {
  ChevronLeft,
  ChevronRight,
  ListPlus,
  Maximize,
  Minimize,
  ListOrdered,
  Repeat2,
  SkipForward,
  X,
} from "lucide-react";
import Image from "next/image";
import type {
  Message,
  KaraokeParty,
  PlaylistOperationResult,
} from "~/shared/party-types";
import usePartySocket from "partysocket/react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import useSound from "use-sound";
import { EmptyPlayer } from "~/components/empty-player";
import { Player, type PlayerActions } from "~/components/player";
import { SongSearch } from "~/components/song-search";
import { Button } from "~/components/ui/ui/button";
import { env } from "~/env";
import { getUrl } from "~/utils/url";
import { esMX } from "~/locales/es-MX";
import { moveInQueue } from "~/utils/playlist";
import {
  ConfettiCanvas,
  type ConfettiCanvasHandle,
} from "~/components/confetti-canvas";
import {
  RatingOverlay,
  type RatingResult,
} from "~/components/rating-overlay";

// Imports implementados por Kikekaraoke
import { AUDIO } from "~/constants/audio";

const INSTITUTIONAL_VIDEO_ID = "oL1w1Xv9f7A";

type Props = {
  party: Party;
  initialPlaylist: KaraokeParty;
};

export default function PlayerScene({ party, initialPlaylist }: Props) {
  const [playlist, setPlaylist] = useState<KaraokeParty["playlist"]>(
    initialPlaylist.playlist ?? [],
  );
  const [fairQueue, setFairQueue] = useState(
    initialPlaylist.settings?.orderByFairness ?? true,
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [pendingPlaylistOperationId, setPendingPlaylistOperationId] =
    useState<string | null>(null);
  const pendingPlaylistOperationRef = useRef<string | null>(null);
  const pendingPlaylistAcceptedRef = useRef(false);
  const pendingPlaylistTimeoutRef = useRef<number | null>(null);

  const [playHorn] = useSound(AUDIO.FXS.KIKERADIO);
  const lastHornTimeRef = useRef<number>(0);
  const togglePlayPauseRef = useRef<(() => void) | null>(null);
  const playerActionsRef = useRef<PlayerActions>(null);
  const currentVideoRef = useRef<KaraokeParty["playlist"][number] | undefined>(
    undefined,
  );
  const [waitingVideoDismissed, setWaitingVideoDismissed] = useState(false);
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null);
  const confettiRef = useRef<ConfettiCanvasHandle>(null);
  const confettiRatingIdRef = useRef<string | null>(null);
  const [fullscreenRequestPending, setFullscreenRequestPending] =
    useState(false);
  const fullscreenRequestTimeoutRef = useRef<number | null>(null);

  const clearFullscreenRequestTimer = () => {
    if (fullscreenRequestTimeoutRef.current !== null) {
      window.clearTimeout(fullscreenRequestTimeoutRef.current);
      fullscreenRequestTimeoutRef.current = null;
    }
  };

  const hideFullscreenRequest = () => {
    clearFullscreenRequestTimer();
    setFullscreenRequestPending(false);
  };

  const showFullscreenRequest = () => {
    clearFullscreenRequestTimer();
    setFullscreenRequestPending(true);
    fullscreenRequestTimeoutRef.current = window.setTimeout(() => {
      fullscreenRequestTimeoutRef.current = null;
      setFullscreenRequestPending(false);
    }, 6000);
  };

  // Throttled horn function
  const playThrottledHorn = () => {
    const now = Date.now();
    const timeSinceLastHorn = now - lastHornTimeRef.current;

    if (timeSinceLastHorn >= 5000) {
      // 5 seconds in milliseconds
      toast.success(esMX.party.hornSent);
      playHorn();
      lastHornTimeRef.current = now;
    } else {
      console.log(
        `Horn throttled. Try again in ${Math.ceil((5000 - timeSinceLastHorn) / 1000)} seconds.`,
      );
    }
  };

  const socket = usePartySocket({
    host: env.NEXT_PUBLIC_PARTYKIT_URL,
    room: party.hash ?? "",
    query: {
      role: "host",
    },
    onMessage(event) {
      // TODO: Improve type safety
      const eventData = JSON.parse(event.data);

      if (eventData.type === "horn") {
        playThrottledHorn();
      }

      if (eventData.type === "play") {
        playerActionsRef.current?.play();
      }

      if (eventData.type === "pause") {
        playerActionsRef.current?.pause();
      }

      if (eventData.type === "reset-song") {
        if (currentVideoRef.current?.id === eventData.id) {
          playerActionsRef.current?.reset();
        }
      }

      if (eventData.type === "toggle-fullscreen") {
        if (fullscreen) {
          void toggle().catch(() => {
            toast.error("No se pudo salir de pantalla completa.");
          });
        } else {
          showFullscreenRequest();
          toast.info("Confirma la pantalla completa en el reproductor.");
        }
      }

      if (eventData.type === "rating-result") {
        setRatingResult(eventData as RatingResult);
      }

      if (eventData.type === "connected") {
        pendingPlaylistAcceptedRef.current = false;
        pendingPlaylistOperationRef.current = null;
        setPendingPlaylistOperationId(null);
        if (pendingPlaylistTimeoutRef.current !== null) {
          window.clearTimeout(pendingPlaylistTimeoutRef.current);
          pendingPlaylistTimeoutRef.current = null;
        }
        if (Array.isArray(eventData.playlist)) {
          setPlaylist(eventData.playlist as KaraokeParty["playlist"]);
        }
        if (eventData.settings) {
          setFairQueue(Boolean(eventData.settings.orderByFairness));
        }
      }

      if (eventData.type === "settings") {
        setFairQueue(Boolean(eventData.settings?.orderByFairness));
      }

      if (eventData.type === "playlist-operation-result") {
        const result = eventData as PlaylistOperationResult;
        if (result.requestId === pendingPlaylistOperationRef.current) {
          pendingPlaylistOperationRef.current = null;
          if (result.accepted) {
            pendingPlaylistAcceptedRef.current = true;
          } else {
            setPendingPlaylistOperationId(null);
            if (pendingPlaylistTimeoutRef.current !== null) {
              window.clearTimeout(pendingPlaylistTimeoutRef.current);
              pendingPlaylistTimeoutRef.current = null;
            }
            toast.error("No se pudo modificar la playlist.", {
              description: result.reason ?? "Operación rechazada por el servidor.",
            });
          }
        }
      }

      if (Array.isArray(eventData)) {
        setPlaylist(eventData as KaraokeParty["playlist"]);
        if (pendingPlaylistAcceptedRef.current) {
          pendingPlaylistAcceptedRef.current = false;
          setPendingPlaylistOperationId(null);
          if (pendingPlaylistTimeoutRef.current !== null) {
            window.clearTimeout(pendingPlaylistTimeoutRef.current);
            pendingPlaylistTimeoutRef.current = null;
          }
        }
      }
    },
  });

  const { ref, toggle, fullscreen } = useFullscreen();

  const confirmFullscreenRequest = async () => {
    try {
      await toggle();
      hideFullscreenRequest();
    } catch {
      toast.error("No se pudo activar la pantalla completa.");
    }
  };

  useEffect(() => {
    if (fullscreen) {
      hideFullscreenRequest();
    }
  }, [fullscreen]);

  useEffect(() => {
    return () => {
      clearFullscreenRequestTimer();
      if (pendingPlaylistTimeoutRef.current !== null) {
        window.clearTimeout(pendingPlaylistTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const portraitMobileOrTablet = window.matchMedia(
      "(orientation: portrait) and (pointer: coarse) and (max-width: 1024px)",
    );
    const toastId = "player-portrait-hint";

    if (portraitMobileOrTablet.matches) {
      toast.info("Mejor experiencia en horizontal", {
        id: toastId,
        description:
          "Gira tu dispositivo para administrar la fiesta con mayor comodidad.",
        duration: 5000,
        icon: <span className="text-2xl">🎤</span>,
        classNames: {
          toast: "bg-slate-950 px-5 py-4 text-white",
          title: "text-base font-bold",
          description: "text-sm text-slate-200",
          icon: "mr-3",
        },
      });
    }

    const handleOrientationChange = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        toast.dismiss(toastId);
      }
    };

    if (portraitMobileOrTablet.addEventListener) {
      portraitMobileOrTablet.addEventListener(
        "change",
        handleOrientationChange,
      );
    } else {
      portraitMobileOrTablet.addListener(handleOrientationChange);
    }

    return () => {
      if (portraitMobileOrTablet.removeEventListener) {
        portraitMobileOrTablet.removeEventListener(
          "change",
          handleOrientationChange,
        );
      } else {
        portraitMobileOrTablet.removeListener(handleOrientationChange);
      }
      toast.dismiss(toastId);
    };
  }, []);

  const currentVideo = playlist.find((video) => !video.playedAt);
  const nextVideos = playlist.filter((video) => !video.playedAt);
  currentVideoRef.current = currentVideo;

  useEffect(() => {
    if (currentVideo) {
      setWaitingVideoDismissed(false);
    }
  }, [currentVideo?.id]);

  const addSong = (videoId: string, title: string, coverUrl: string) => {
    const singerName = readLocalStorageValue({
      key: "name",
      defaultValue: "Host",
    });

    socket.send(
      JSON.stringify({
        type: "add-video",
        id: videoId,
        title,
        singerName,
        coverUrl,
      } satisfies Message),
    );
  };

  const removeSong = (videoId: string) => {
    socket.send(
      JSON.stringify({
        type: "remove-video",
        id: videoId,
      } satisfies Message),
    );
  };

  const createRequestId = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  const beginPlaylistOperation = (requestId: string) => {
    pendingPlaylistOperationRef.current = requestId;
    setPendingPlaylistOperationId(requestId);
    pendingPlaylistTimeoutRef.current = window.setTimeout(() => {
      if (pendingPlaylistOperationRef.current !== requestId) return;

      pendingPlaylistOperationRef.current = null;
      pendingPlaylistAcceptedRef.current = false;
      setPendingPlaylistOperationId(null);
      pendingPlaylistTimeoutRef.current = null;
      toast.warning("No se pudo confirmar el cambio.", {
        description: "Se solicitará una sincronización al reconectar.",
      });
      socket.close();
    }, 5000);
  };

  const moveSong = (videoId: string, toIndex: number) => {
    if (pendingPlaylistOperationId) return;
    if (moveInQueue(playlist, videoId, toIndex) === playlist) return;

    const requestId = createRequestId();
    beginPlaylistOperation(requestId);
    socket.send(
      JSON.stringify({
        type: "move-video",
        requestId,
        id: videoId,
        toIndex,
      } satisfies Message),
    );
  };

  const toggleFairQueue = () => {
    if (pendingPlaylistOperationId) return;

    const requestId = createRequestId();
    beginPlaylistOperation(requestId);
    socket.send(
      JSON.stringify({
        type: "set-fair-queue",
        requestId,
        enabled: !fairQueue,
      } satisfies Message),
    );
  };

  const sendSocketMessage = (message: Message) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(message));
  };

  const markAsPlayed = () => {
    if (currentVideo) {
      sendSocketMessage({
        type: "mark-as-played",
        id: currentVideo.id,
      } satisfies Message);
    }
  };

  // Add keyboard shortcuts
  // f - fullscreen toggle, space - play/pause, right arrow - skip video
  useHotkeys([
    ["f", toggle],
    ["Space", () => togglePlayPauseRef.current?.()],
    [
      "ArrowRight",
      () => {
        if (currentVideo) {
          markAsPlayed();
        }
      },
    ],
  ]);

  const joinPartyUrl = getUrl(`/join/${party.hash}`);

  return (
    <div className="flex h-screen w-full flex-row flex-nowrap">
      <div className="grow-0 basis-1/3 overflow-y-auto border-r border-slate-500 px-4">
        <div className="py-4 text-center">
          <h1 className="text-outline scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl">
            {party.name}
          </h1>
          <div className="mt-1 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-white">
            <span className="text-emerald-400">🟢</span>
            <span>HOST</span>
          </div>
        </div>
        <SongSearch
          key={party.hash}
          playlist={playlist}
          onVideoAdded={addSong}
        />
      </div>
      <div className="grow-0 basis-2/3 overflow-auto">
        <div className="flex h-full flex-col">
          <div className="relative h-5/6" ref={ref}>
            <Button
              onClick={toggle}
              variant="ghost"
              size="icon"
              className="absolute bottom-0 right-3 z-10"
            >
              {fullscreen ? <Minimize /> : <Maximize />}
            </Button>
            {fullscreenRequestPending && !fullscreen && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 px-5 py-3 text-base"
                  onClick={() => void confirmFullscreenRequest()}
                >
                  <Maximize className="mr-2 h-5 w-5" />
                  Presiona aquí para ampliar a pantalla completa
                </Button>
              </div>
            )}
            {currentVideo ? (
              <Player
                ref={playerActionsRef}
                key={currentVideo.id}
                video={currentVideo}
                joinPartyUrl={joinPartyUrl}
                isFullscreen={fullscreen}
                onPlayerEnd={() => {
                  markAsPlayed();
                }}
                onTogglePlayPauseRef={togglePlayPauseRef}
              />
            ) : !waitingVideoDismissed ? (
              <Player
                ref={playerActionsRef}
                key={INSTITUTIONAL_VIDEO_ID}
                video={{
                  id: INSTITUTIONAL_VIDEO_ID,
                  title: "Video institucional",
                  singerName: "",
                }}
                joinPartyUrl={joinPartyUrl}
                isFullscreen={fullscreen}
                isWaiting={true}
                onPlayerEnd={() => {
                  setWaitingVideoDismissed(true);
                }}
                onTogglePlayPauseRef={togglePlayPauseRef}
              />
            ) : (
              <EmptyPlayer
                joinPartyUrl={joinPartyUrl}
                className={fullscreen ? "bg-gradient" : ""}
              />
            )}
            {ratingResult ? (
              <>
                {ratingResult.score === 10 ? (
                  <ConfettiCanvas ref={confettiRef} />
                ) : null}
                <RatingOverlay
                  result={ratingResult}
                  onComplete={() => setRatingResult(null)}
                  onReveal={() => {
                    if (
                      ratingResult.score === 10 &&
                      confettiRatingIdRef.current !== ratingResult.ratingId
                    ) {
                      confettiRatingIdRef.current = ratingResult.ratingId;
                      confettiRef.current?.fire();
                    }
                  }}
                />
              </>
            ) : null}
          </div>
          <div className="h-1/6 min-h-[150px] border-t border-slate-500 px-4 py-2">
            <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-7 shrink-0 items-center gap-2">
              <button
                type="button"
                className={`inline-flex h-7 w-7 items-center justify-center p-0 ${
                  fairQueue ? "text-[#68A88A]" : "text-[#A0A0A0]"
                } disabled:opacity-50`}
                onClick={toggleFairQueue}
                disabled={Boolean(pendingPlaylistOperationId)}
                title={
                  fairQueue
                    ? "TURNOS activo: pulsar para pasar a MANUAL"
                    : "MANUAL activo: pulsar para activar TURNOS"
                }
              >
                {fairQueue ? (
                  <Repeat2 className="h-4 w-4" />
                ) : (
                  <ListOrdered className="h-4 w-4" />
                )}
              </button>
              {pendingPlaylistOperationId ? (
                <span className="text-xs text-slate-400">Sincronizando…</span>
              ) : null}
            </div>
            {nextVideos.length > 0 ? (
              <>
                <div className="no-scrollbar flex min-h-0 flex-1 flex-row space-x-2 overflow-x-scroll">
                  {nextVideos.map((v, i) => {
                    const isCurrent = i === 0;
                    const isDragging = draggedId === v.id;

                    return (
                    <div
                      key={v.id}
                      draggable={!isCurrent && !pendingPlaylistOperationId}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", v.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggedId(v.id);
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDragOverIndex(null);
                      }}
                      onDragOver={(event) => {
                        if (!draggedId || isCurrent || pendingPlaylistOperationId) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDragOverIndex(i);
                      }}
                      onDragLeave={() => {
                        setDragOverIndex((current) =>
                          current === i ? null : current,
                        );
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (draggedId && !isCurrent) moveSong(draggedId, i);
                        setDraggedId(null);
                        setDragOverIndex(null);
                      }}
                      className={`relative flex aspect-[4/3] h-full items-center justify-center rounded-lg bg-slate-200 p-3 text-center text-primary-foreground animate-in slide-in-from-bottom first:border-2 first:border-amber-500 ${
                        !isCurrent ? "cursor-grab active:cursor-grabbing" : ""
                      } ${isDragging ? "opacity-40" : ""} ${
                        dragOverIndex === i && !isDragging
                          ? "ring-2 ring-amber-400"
                          : ""
                      }`}
                    >
                      <Image
                        src={v.coverUrl}
                        fill={true}
                        className="pointer-events-none rounded-lg hover:opacity-50"
                        alt="Cover"
                      />

                      <Button
                        variant="link"
                        size="icon"
                        className="absolute right-0 top-0 z-10 hover:bg-gray-400"
                        onClick={() => {
                          removeSong(v.id);
                        }}
                      >
                        <X color="red" />
                      </Button>

                      {isCurrent && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute bottom-0 right-0 z-10 rounded text-yellow-300 hover:bg-gray-400"
                          onClick={() => {
                            markAsPlayed();
                          }}
                        >
                          <SkipForward />
                        </Button>
                      )}

                      {!isCurrent && i > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute bottom-0 left-0 z-10 rounded text-yellow-300 hover:bg-gray-400"
                          disabled={Boolean(pendingPlaylistOperationId)}
                          title="Subir una posición"
                          onClick={() => moveSong(v.id, i - 1)}
                        >
                          <ChevronLeft />
                        </Button>
                      )}

                      {!isCurrent && i < nextVideos.length - 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute bottom-0 right-0 z-10 rounded text-yellow-300 hover:bg-gray-400"
                          disabled={Boolean(pendingPlaylistOperationId)}
                          title="Bajar una posición"
                          onClick={() => moveSong(v.id, i + 1)}
                        >
                          <ChevronRight />
                        </Button>
                      )}

                      {/* <div>{decode(v.title)}</div> */}
                    </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex aspect-[4/3] h-full items-center justify-center rounded-lg border-2 border-dashed border-slate-500 bg-slate-200 p-3 text-center text-slate-500">
                <ListPlus
                  size={32}
                  strokeWidth={1.5}
                  className="animate-bounce"
                />
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
