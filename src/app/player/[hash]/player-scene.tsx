/* eslint-disable */
"use client";

import {
  readLocalStorageValue,
  useFullscreen,
  useHotkeys,
} from "@mantine/hooks";
import type { Party } from "@prisma/client";
import { ListPlus, Maximize, Minimize, SkipForward, X } from "lucide-react";
import Image from "next/image";
import type { Message, KaraokeParty } from "party";
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
import { ensureSessionId } from "~/lib/session";
import { recordDiagnostic } from "~/lib/diagnostics";

// Imports implementados por Kikekaraoke
import { AUDIO } from "~/constants/audio";

const INSTITUTIONAL_VIDEO_ID = "oL1w1Xv9f7A";

function summarizePlaylist(playlist: KaraokeParty["playlist"]) {
  const pending = playlist.filter((video) => video && !video.playedAt);
  return {
    length: playlist.length,
    pendingCount: pending.length,
    pendingVideoIds: pending.map((video) => video.id),
    currentVideoId: pending[0]?.id,
  };
}

type Props = {
  party: Party;
  initialPlaylist: KaraokeParty;
};

export default function PlayerScene({ party, initialPlaylist }: Props) {
  const [playlist, setPlaylist] = useState<KaraokeParty["playlist"]>(
    initialPlaylist.playlist ?? [],
  );

  const [playHorn] = useSound(AUDIO.FXS.KIKERADIO);
  const lastHornTimeRef = useRef<number>(0);
  const togglePlayPauseRef = useRef<(() => void) | null>(null);
  const playerActionsRef = useRef<PlayerActions>(null);
  const [waitingVideoDismissed, setWaitingVideoDismissed] = useState(false);
  const sessionId = ensureSessionId();

  const diag = (
    event: string,
    context: Record<string, unknown> = {},
    error?: unknown,
  ) => {
    recordDiagnostic({
      event: `host.${event}`,
      component: "PlayerScene",
      roomId: party.hash ?? undefined,
      role: "HOST",
      sessionId,
      context,
      error,
    });
  };

  useEffect(() => {
    diag("mount", { playlist: summarizePlaylist(initialPlaylist.playlist ?? []) });
    return () => diag("unmount");
  }, []);

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
      let eventData: any;
      try {
        eventData = JSON.parse(event.data as string);
      } catch (error) {
        diag("socket.message.parse-failed", { bytes: String(event.data).length }, error);
        throw error;
      }

      diag("socket.message.received", {
        type: Array.isArray(eventData) ? "playlist" : eventData?.type,
      });

      if (eventData.type === "horn") {
        playThrottledHorn();
      }

      if (eventData.type === "play") {
        playerActionsRef.current?.play();
      }

      if (eventData.type === "pause") {
        playerActionsRef.current?.pause();
      }

      if (eventData.type === "toggle-fullscreen") {
        void toggle().catch(() => undefined);
      }

      if (Array.isArray(eventData)) {
        const nextPlaylist = eventData as KaraokeParty["playlist"];
        diag("playlist.received", summarizePlaylist(nextPlaylist));
        setPlaylist(nextPlaylist);
      }
    },
  });

  // SINGER_SYNC: envia muestras del Host sin cambiar los mensajes normales.
  const sendSyncPlayback = (videoId: string, sample: { position: number; isPlaying: boolean }) => {
    diag("sync.playback.send.start", {
      videoId,
      position: sample.position,
      isPlaying: sample.isPlaying,
      socketReadyState: socket.readyState,
    });
    if (socket.readyState !== WebSocket.OPEN) {
      diag("sync.playback.send.failure", { videoId, reason: "socket-not-open", socketReadyState: socket.readyState });
      return;
    }
    try {
      socket.send(JSON.stringify({ type: "sync-playback", videoId, ...sample }));
      diag("sync.playback.send.success", { videoId });
    } catch (error) {
      diag("sync.playback.send.failure", { videoId, socketReadyState: socket.readyState }, error);
      throw error;
    }
  };

  const { ref, toggle, fullscreen } = useFullscreen();

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

  const previousCurrentVideoIdRef = useRef<string | undefined>(currentVideo?.id);

  useEffect(() => {
    const previousVideoId = previousCurrentVideoIdRef.current;
    const nextVideoId = currentVideo?.id;
    if (previousVideoId !== nextVideoId) {
      diag("playlist.current.changed", {
        previousVideoId,
        nextVideoId,
        playlistLength: playlist.length,
        pendingCount: nextVideos.length,
      });
    }
    previousCurrentVideoIdRef.current = nextVideoId;
  }, [currentVideo?.id, playlist.length, nextVideos.length]);

  useEffect(() => {
    const renderedPlayerId = currentVideo?.id ?? (!waitingVideoDismissed ? INSTITUTIONAL_VIDEO_ID : undefined);
    if (!renderedPlayerId) return;
    diag("player.scene.mount", {
      videoId: renderedPlayerId,
      playerType: renderedPlayerId === INSTITUTIONAL_VIDEO_ID && !currentVideo ? "institutional" : "song",
    });
    return () => {
      diag("player.scene.unmount", {
        videoId: renderedPlayerId,
        playerType: renderedPlayerId === INSTITUTIONAL_VIDEO_ID && !currentVideo ? "institutional" : "song",
      });
    };
  }, [currentVideo?.id, waitingVideoDismissed]);

  // SINGER_SYNC: heartbeat de telemetria, sin correccion de drift.
  useEffect(() => {
    const heartbeat = window.setInterval(() => {
      if (!currentVideo) return;
      diag("sync.sample.start", { videoId: currentVideo.id, source: "heartbeat" });
      const samplePromise = playerActionsRef.current?.getPlaybackSample();
      if (samplePromise) {
        void samplePromise.then(
          (sample) => {
            diag("sync.sample.success", { videoId: currentVideo.id, source: "heartbeat", ...sample });
            sendSyncPlayback(currentVideo.id, sample);
          },
          (error: unknown) => {
            diag("sync.sample.failure", { videoId: currentVideo.id, source: "heartbeat" }, error);
          },
        );
      } else {
        diag("sync.sample.failure", { videoId: currentVideo.id, source: "heartbeat", reason: "player-actions-unavailable" });
      }
    }, 30_000);
    return () => window.clearInterval(heartbeat);
  }, [currentVideo?.id, socket]);

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
            diagnosticContext={{ roomId: party.hash ?? undefined, role: "HOST", sessionId }}
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
                diagnosticContext={{ roomId: party.hash ?? undefined, role: "HOST", sessionId }}
                onPlaybackSample={(sample) => sendSyncPlayback(currentVideo.id, sample)}
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
                diagnosticContext={{ roomId: party.hash ?? undefined, role: "HOST", sessionId }}
              />
            ) : (
              <EmptyPlayer
                joinPartyUrl={joinPartyUrl}
                className={fullscreen ? "bg-gradient" : ""}
              />
            )}
          </div>
          <div className="h-1/6 min-h-[150px] border-t border-slate-500 p-4">
            {nextVideos.length > 0 ? (
              <>
                <div className="no-scrollbar flex h-full flex-row space-x-2 overflow-x-scroll">
                  {nextVideos.map((v, i) => (
                    <div
                      key={v.id}
                      className="relative flex aspect-[4/3] h-full items-center justify-center rounded-lg bg-slate-200 p-3 text-center text-primary-foreground animate-in slide-in-from-bottom first:border-2 first:border-amber-500"
                    >
                      <Image
                        src={v.coverUrl}
                        fill={true}
                        className="rounded-lg hover:opacity-50"
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

                      {i === 0 && (
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

                      {/* <div>{decode(v.title)}</div> */}
                    </div>
                  ))}
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
  );
}
