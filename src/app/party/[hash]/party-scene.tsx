/* eslint-disable */
"use client";

import type { Party } from "@prisma/client";
import type {
  Message,
  KaraokeParty,
  PlaylistOperationResult,
} from "~/shared/party-types";
import { useEffect, useState, useRef } from "react";
import { env } from "~/env";
import { readLocalStorageValue, useLocalStorage } from "@mantine/hooks";
import { SongSearch } from "~/components/song-search";
import {
  ChevronDown,
  ChevronUp,
  ListOrdered,
  ListMusic,
  Maximize,
  Megaphone,
  Pause,
  Play,
  RotateCcw,
  Repeat2,
  Share2,
  SkipForward,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import usePartySocket from "partysocket/react";
import { ensureSessionId } from "~/lib/session";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/ui/accordion";
import { decode } from "html-entities";
import { useRouter } from "next/navigation";
import { esMX } from "~/locales/es-MX";
import { AppTextBrand } from "~/components/app-text-brand";
import { InvitePartyDialog } from "~/components/invite-party-dialog";
import { getUrl } from "~/utils/url";
import { moveInQueue } from "~/utils/playlist";

function getTitleSizeClass(title: string) {
  const length = title.trim().length;

  if (length <= 14) {
    return "text-2xl sm:text-2xl lg:text-3xl";
  }

  if (length <= 20) {
    return "text-xl sm:text-2xl lg:text-3xl";
  }

  if (length <= 28) {
    return "text-lg sm:text-xl lg:text-2xl";
  }

  return "text-base sm:text-lg lg:text-xl";
}

export function PartyScene({
  party,
  initialPlaylist,
}: {
  party: Party;
  initialPlaylist?: KaraokeParty;
}) {
  const [name] = useLocalStorage<string>({ key: "name" });
  const router = useRouter();

  const [playlist, setPlaylist] = useState<KaraokeParty["playlist"]>(
    initialPlaylist?.playlist ?? [],
  );
  const [fairQueue, setFairQueue] = useState(
    initialPlaylist?.settings?.orderByFairness ?? true,
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [pendingPlaylistOperationId, setPendingPlaylistOperationId] =
    useState<string | null>(null);
  const pendingPlaylistOperationRef = useRef<string | null>(null);
  const pendingPlaylistAcceptedRef = useRef(false);
  const pendingPlaylistTimeoutRef = useRef<number | null>(null);
  const [hostName, setHostName] = useState(party.name);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const previousScrollTopRef = useRef(0);
  const [isBrandScrolled, setIsBrandScrolled] = useState(false);
  const [isPlaylistVisible, setIsPlaylistVisible] = useState(true);
  const [isResetPending, setIsResetPending] = useState(false);
  const [isRatingPending, setIsRatingPending] = useState(false);

  useEffect(() => {
    const content = contentScrollRef.current;

    if (!content) {
      return;
    }

    const handleScroll = () => {
      const scrollTop = content.scrollTop;

      setIsBrandScrolled(scrollTop > 4);

      if (scrollTop <= 0 || scrollTop < previousScrollTopRef.current) {
        setIsPlaylistVisible(true);
      } else if (scrollTop > previousScrollTopRef.current) {
        setIsPlaylistVisible(false);
      }

      previousScrollTopRef.current = scrollTop;
    };

    content.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      content.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const value = readLocalStorageValue<string | null>({ key: "name" });

    if (!value) {
      router.push(`/join/${party.hash}`);
      return;
    }

    setHostName(value);
  }, [party.hash, party.name, router]);

  type ClientRole = "HOST" | "COHOST" | "INVITADO";

  const [role, setRole] = useState<ClientRole>("INVITADO");

  const socket = usePartySocket({
    host: env.NEXT_PUBLIC_PARTYKIT_URL,
    room: party.hash ?? "",
    query: {
      role: "guest",
      sessionId: ensureSessionId(),
    },
    onMessage(event) {
      try {
        const eventData = JSON.parse(event.data);

        if (eventData.type === "role-assigned") {
          setRole(eventData.role);

          if (eventData.role === "COHOST" && eventData.message) {
            toast.success(eventData.message);
          }

          return;
        }

        if (eventData.type === "horn") {
          return;
        }

        if (eventData.type === "reset-song") {
          setIsResetPending(false);
          return;
        }

        if (eventData.type === "rating-result") {
          setIsRatingPending(false);
          return;
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
            setPlaylist(eventData.playlist);
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
                description:
                  result.reason ?? "Operación rechazada por el servidor.",
              });
            }
          }
        }

        if (Array.isArray(eventData)) {
          setPlaylist(eventData);
          if (pendingPlaylistAcceptedRef.current) {
            pendingPlaylistAcceptedRef.current = false;
            setPendingPlaylistOperationId(null);
            if (pendingPlaylistTimeoutRef.current !== null) {
              window.clearTimeout(pendingPlaylistTimeoutRef.current);
              pendingPlaylistTimeoutRef.current = null;
            }
          }
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    },
  });

  useEffect(() => {
    return () => {
      if (pendingPlaylistTimeoutRef.current !== null) {
        window.clearTimeout(pendingPlaylistTimeoutRef.current);
      }
    };
  }, []);

  const sendSocketMessage = (message: Message) => {
    socket.send(JSON.stringify(message));
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
    if (role !== "COHOST" || pendingPlaylistOperationId) return;
    if (moveInQueue(playlist, videoId, toIndex) === playlist) return;

    const requestId = createRequestId();
    beginPlaylistOperation(requestId);
    sendSocketMessage({
      type: "move-video",
      requestId,
      id: videoId,
      toIndex,
    });
  };

  const toggleFairQueue = () => {
    if (role !== "COHOST" || pendingPlaylistOperationId) return;

    const requestId = createRequestId();
    beginPlaylistOperation(requestId);
    sendSocketMessage({
      type: "set-fair-queue",
      requestId,
      enabled: !fairQueue,
    });
  };

  const FairnessIcon = fairQueue ? Repeat2 : ListOrdered;
  const fairnessIconColor = fairQueue ? "text-[#68A88A]" : "text-[#A0A0A0]";

  const addSong = async (videoId: string, title: string, coverUrl: string) => {
    sendSocketMessage({
      type: "add-video",
      id: videoId,
      title,
      singerName: name,
      coverUrl,
    } satisfies Message);
  };

  const sendHorn = async () => {
    sendSocketMessage({
      type: "horn",
    } satisfies Message);
  };

  const sendPlay = () => {
    sendSocketMessage({ type: "play" } as Message);
  };

  const sendPause = () => {
    sendSocketMessage({ type: "pause" } as Message);
  };

  const sendResetSong = () => {
    if (!nextVideo || isResetPending) {
      if (!nextVideo) {
        toast.error("No hay una canción activa para reiniciar.");
      }
      return;
    }

    setIsResetPending(true);
    sendSocketMessage({
      type: "reset-song",
      id: nextVideo.id,
    } satisfies Message);

    window.setTimeout(() => {
      setIsResetPending(false);
    }, 1000);
  };

  const sendToggleFullscreen = () => {
    sendSocketMessage({ type: "toggle-fullscreen" } satisfies Message);
  };

  const sendRating = () => {
    if (isRatingPending) return;

    if (socket.readyState !== WebSocket.OPEN) {
      toast.error("No se pudo enviar la calificación.");
      return;
    }

    setIsRatingPending(true);
    socket.send(
      JSON.stringify({
        type: "rating-request",
        requestId:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
      }),
    );

    window.setTimeout(() => {
      setIsRatingPending(false);
    }, 6000);
  };

  const sendSkip = () => {
    if (!nextVideo) return;

    sendSocketMessage({
      type: "mark-as-played",
      id: nextVideo.id,
    } satisfies Message);
  };

  const nextVideos = playlist.filter((video) => !video.playedAt);
  const nextVideo = nextVideos[0] ?? null;
  const joinPartyUrl = getUrl(`/join/${party.hash}`);

  return (
    <>
      <div className="container mx-auto flex h-screen flex-col p-6 pb-16 text-center">
        <div className="mx-auto flex min-h-0 w-full flex-1 flex-col items-center md:w-1/2 xl:w-1/3 md:items-start">

          <div className="sticky top-0 z-20 flex shrink-0 items-center justify-center">
            <AppTextBrand
              className={`[&>img]:origin-top [&>img]:transition-transform [&>img]:duration-300 [&>img]:ease-out ${
                isBrandScrolled
                  ? "[&>img]:scale-90"
                  : "[&>img]:scale-100"
              }`}
            />
          </div>

          <div
            className={`mt-2 flex flex-col items-center gap-4 transition-[max-height,opacity,transform] duration-300 ease-out md:items-start md:gap-3 ${
                isBrandScrolled
                  ? "pointer-events-none max-h-0 -translate-y-2 overflow-hidden opacity-0"
                  : "max-h-96 translate-y-0 opacity-100"
              }`}
            >
              <div className="flex w-full max-w-full flex-wrap items-center justify-between gap-3 md:flex-nowrap">
                <h1
                  className={`text-outline min-w-0 max-w-full scroll-m-20 whitespace-normal break-words font-extrabold tracking-tight md:whitespace-nowrap ${getTitleSizeClass(party.name)}`}
                >
                  Fiesta de {party.name}
                </h1>
                <InvitePartyDialog
                  url={joinPartyUrl}
                  trigger={
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/85 shadow-sm backdrop-blur-sm transition-all hover:bg-white/15 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      <Share2 className="h-4 w-4" aria-hidden="true" />
                      <span>Invitar</span>
                    </button>
                  }
                />
              </div>

          <div className="inline-flex flex-wrap items-center gap-2 text-lg font-semibold text-white/90 md:justify-start">
            <span>👋 ¡Hola, {hostName}!</span>
            {role === "COHOST" ? (
              <span className="inline-flex items-center gap-2 text-lg font-semibold text-white/90">
                <span className="text-emerald-400">🟢</span>
                <span>CO HOST</span>
              </span>
            ) : role === "INVITADO" ? (
              <span className="text-white">🙂</span>
            ) : null}
          </div>

          </div>

          <div
            ref={contentScrollRef}
            className="min-h-0 w-full flex-1 overflow-y-auto pt-4 md:pt-3"
          >
            <div className="w-full">
              <SongSearch onVideoAdded={addSong} playlist={playlist} />
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[100] flex max-h-[100dvh] flex-col">
        <div
          className={`min-h-0 w-full overflow-y-auto bg-primary p-1 text-primary-foreground text-white transition-[transform,opacity] duration-200 ease-out ${
            isPlaylistVisible
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-full opacity-0"
          }`}
        >
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border-0">
              <div className="flex w-full min-w-0 items-stretch border-b border-accent-foreground">
                <AccordionTrigger
                  className="min-w-0 flex-1 !py-1"
                  disabled={nextVideos.length < 2}
                >
                  <div className="flex min-w-0 flex-row items-center">
                    <ListMusic
                      className={`mr-3 shrink-0 ${
                        fairQueue ? "text-emerald-300" : "text-slate-300"
                      }`}
                      aria-label={fairQueue ? "TURNOS" : "MANUAL"}
                    />
                    {nextVideo ? (
                      <span className="mr-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-white/90">
                        <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                      </span>
                    ) : null}
                    {nextVideo ? (
                      <div className="min-w-0 text-left">
                        <div className="truncate leading-tight">
                          {decode(nextVideo.title)}
                        </div>
                        {nextVideo.singerName ? (
                          <div className="truncate text-sm font-normal leading-tight text-white/70">
                            {nextVideo.singerName}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      esMX.party.playlistEmpty
                    )}
                  </div>
                </AccordionTrigger>
              </div>
              <AccordionContent className="!pb-0 !pt-0">
                <ul className="divide-y divide-accent-foreground">
                  {nextVideos.slice(1).map((video, index) => {
                    const queueIndex = index + 1;
                    const isDragging = draggedId === video.id;

                    return (
                    <li
                      key={video.id}
                      draggable={role === "COHOST" && !pendingPlaylistOperationId}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", video.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggedId(video.id);
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDragOverId(null);
                      }}
                      onDragOver={(event) => {
                        if (
                          role !== "COHOST" ||
                          !draggedId ||
                          pendingPlaylistOperationId
                        ) {
                          return;
                        }
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDragOverId(video.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (draggedId && role === "COHOST") {
                          moveSong(draggedId, queueIndex);
                        }
                        setDraggedId(null);
                        setDragOverId(null);
                      }}
                      className={`${
                        role === "COHOST" ? "flex items-start gap-2" : ""
                      } px-2 py-0.5 first:pt-0 last:pb-0 ${
                        isDragging ? "opacity-40" : ""
                      } ${
                        dragOverId === video.id ? "rounded ring-2 ring-amber-400" : ""
                      }`}
                    >
                      <div
                        className={`${
                          role === "COHOST" ? "flex-1" : ""
                        } min-w-0 pl-16 text-left`}
                      >
                        <div className="truncate leading-tight">{decode(video.title)}</div>
                        {video.singerName ? (
                          <div className="truncate text-sm font-normal leading-tight text-white/70">
                            {video.singerName}
                          </div>
                        ) : null}
                      </div>
                      {role === "COHOST" ? (
                        <div className="flex shrink-0 items-center gap-1">
                          {queueIndex > 1 ? (
                            <button
                              type="button"
                              className="rounded p-1 text-white/70 hover:bg-white/10 disabled:opacity-50"
                              onClick={() => moveSong(video.id, queueIndex - 1)}
                              disabled={Boolean(pendingPlaylistOperationId)}
                              title="Subir una posición"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                          ) : null}
                          {queueIndex < nextVideos.length - 1 ? (
                            <button
                              type="button"
                              className="rounded p-1 text-white/70 hover:bg-white/10 disabled:opacity-50"
                              onClick={() => moveSong(video.id, queueIndex + 1)}
                              disabled={Boolean(pendingPlaylistOperationId)}
                              title="Bajar una posición"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                    );
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="flex w-full flex-col items-center justify-center bg-black/80">
          <div className="flex max-w-full flex-wrap items-center gap-6 sm:gap-8 self-center rounded-full border border-white/10 bg-black/70 px-2 py-1 shadow-xl backdrop-blur">
            {role === "COHOST" ? (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center p-1 text-white/80 disabled:opacity-50"
                onClick={toggleFairQueue}
                disabled={Boolean(pendingPlaylistOperationId)}
                aria-label={
                  fairQueue
                    ? "Cambiar de TURNOS a MANUAL"
                    : "Cambiar de MANUAL a TURNOS"
                }
                title={
                  fairQueue
                    ? "Cambiar de TURNOS a MANUAL"
                    : "Cambiar de MANUAL a TURNOS"
                }
              >
                <FairnessIcon className={`h-5 w-5 ${fairnessIconColor}`} />
              </button>
            ) : null}
            <div className="flex items-center">
              <button
                type="button"
                className="rounded-full bg-yellow-200 p-2 text-black shadow-lg hover:bg-red-700 hover:text-white"
                onClick={sendHorn}
              >
                <Megaphone size={32} />
              </button>
            </div>
            {role === "COHOST" && (
              <div className="flex min-w-0 flex-wrap items-center justify-center gap-3.5 sm:gap-4">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={sendResetSong}
                  disabled={!nextVideo || isResetPending}
                  aria-label="Reiniciar canción"
                  title="Reiniciar canción"
                >
                  <RotateCcw
                    className={`h-5 w-5 ${isResetPending ? "animate-spin" : ""}`}
                  />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={sendPlay}
                  aria-label="Reproducir canción"
                  title="Reproducir canción"
                >
                  <Play className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={sendPause}
                  aria-label="Pausar canción"
                  title="Pausar canción"
                >
                  <Pause className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={sendSkip}
                  disabled={!nextVideo}
                  aria-label="Siguiente canción"
                  title="Siguiente canción"
                >
                  <SkipForward className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={sendToggleFullscreen}
                  aria-label="Pantalla completa"
                  title="Pantalla completa"
                >
                  <Maximize className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="ml-1 inline-flex min-w-[7.5rem] cursor-pointer items-center justify-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-3"
                  onClick={sendRating}
                  disabled={isRatingPending}
                  aria-label="Calificar interpretación"
                  title="Calificar interpretación"
                >
                  <Star className="h-5 w-5" />
                  <span>{isRatingPending ? "Calificando" : "Calificar"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
