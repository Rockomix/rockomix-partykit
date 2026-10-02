/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import YouTube, { type YouTubeProps, type YouTubePlayer } from "react-youtube";
import { QrCode } from "./qr-code";
import { type VideoInPlaylist } from "party";
import { decode } from "html-entities";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { Button } from "./ui/ui/button";
import { MicVocal, SkipForward, Youtube } from "lucide-react";
import { Spinner } from "./ui/ui/spinner";
import { esMX } from "~/locales/es-MX";
import { APP_TEXT_BRAND } from "~/constants/app";
import { recordDiagnostic } from "~/lib/diagnostics";

type PlayerDiagnosticContext = {
  roomId?: string;
  role?: string;
  sessionId?: string;
};

type Props = {
  joinPartyUrl: string;
  video: Pick<VideoInPlaylist, "id" | "title" | "singerName">;
  isFullscreen: boolean;
  onPlayerEnd: () => void;
  onTogglePlayPauseRef?: React.MutableRefObject<(() => void) | null>;
  isWaiting?: boolean;
  // SINGER_SYNC: solo informa telemetria; no modifica los controles normales.
  onPlaybackSample?: (sample: { position: number; isPlaying: boolean }) => void;
  diagnosticContext?: PlayerDiagnosticContext;
};

export type PlayerActions = {
  play: () => void;
  pause: () => void;
  skip: () => void;
  toggle: () => void;
  getPlaybackSample: () => Promise<{ position: number; isPlaying: boolean }>;
};

export const Player = forwardRef<PlayerActions, Props>(function Player(
  {
    joinPartyUrl,
    video,
    isFullscreen = false,
    onPlayerEnd: onPlayerEnded,
    onTogglePlayPauseRef,
    isWaiting = false,
    onPlaybackSample,
    diagnosticContext,
  }: Props,
  ref,
) {
  const playerRef = useRef<YouTubePlayer>(null);
  const previousPlayerStateRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [showOpenInYouTubeButton, setShowOpenInYouTubeButton] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const getPlayerStateForDiagnostics = (target: unknown): number | undefined => {
    try {
      const state = (target as { getPlayerState?: () => unknown } | null)?.getPlayerState?.();
      return typeof state === "number" ? state : undefined;
    } catch {
      return undefined;
    }
  };

  const recordPlayerDiagnostic = (
    event: string,
    context: Record<string, unknown> = {},
    error?: unknown,
  ) => {
    recordDiagnostic({
      event,
      component: "Player",
      roomId: diagnosticContext?.roomId,
      role: diagnosticContext?.role,
      sessionId: diagnosticContext?.sessionId,
      context: { videoId: video.id, isWaiting, ...context },
      error,
    });
  };

  useEffect(() => {
    recordPlayerDiagnostic("player.mount");
    return () => recordPlayerDiagnostic("player.unmount");
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!playerRef.current || !isReady) {
      return;
    }

    const playerState = playerRef.current.getPlayerState();
    // YouTube player states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
    if (playerState === 1) {
      // Playing - pause it
      playerRef.current.pauseVideo();
    } else if (playerState === 2 || playerState === 5 || playerState === -1) {
      // Paused, cued, or unstarted - play it
      playerRef.current.playVideo();
    }
  }, [isReady]);

  // Set ref for global play/pause
  useEffect(() => {
    if (onTogglePlayPauseRef && isReady) {
      onTogglePlayPauseRef.current = togglePlayPause;
    }
  }, [onTogglePlayPauseRef, togglePlayPause, isReady]);

  const play = useCallback(() => {
    if (!playerRef.current || !isReady) {
      return;
    }

    const state = playerRef.current.getPlayerState();
    if (state !== 1) {
      playerRef.current.playVideo();
    }
  }, [isReady]);

  const pause = useCallback(() => {
    if (!playerRef.current || !isReady) {
      return;
    }

    const state = playerRef.current.getPlayerState();
    if (state === 1 || state === 3 || state === 5 || state === -1) {
      playerRef.current.pauseVideo();
    }
  }, [isReady]);

  const getPlaybackSample = useCallback(async () => {
    recordPlayerDiagnostic("sync.sample.start");
    try {
      const sample = {
        position: (await playerRef.current?.getCurrentTime?.()) ?? 0,
        isPlaying: (await playerRef.current?.getPlayerState?.()) === 1,
      };
      recordPlayerDiagnostic("sync.sample.success", sample);
      return sample;
    } catch (error) {
      recordPlayerDiagnostic("sync.sample.failure", {}, error);
      throw error;
    }
  }, [video.id, isWaiting, diagnosticContext?.roomId, diagnosticContext?.role, diagnosticContext?.sessionId]);

  const skip = useCallback(() => {
    onPlayerEnded();
  }, [onPlayerEnded]);

  useImperativeHandle(
    ref,
    () => ({
      play,
      pause,
      skip,
      toggle: togglePlayPause,
      getPlaybackSample,
    }),
    [getPlaybackSample, pause, play, skip, togglePlayPause],
  );

  const opts: YouTubeProps["opts"] = {
    playerVars: {
      // https://developers.google.com/youtube/player_parameters
      start: 0,
      autoplay: 1,
      rel: 0,
      controls: 1,
      ...(isWaiting
        ? {
            loop: 1,
            playlist: video.id,
          }
        : {}),
    },
  };

  const totalHeaderLength =
    decode(video.title).length + (video.singerName?.length ?? 0);
  const titleSizeClass =
    totalHeaderLength <= 30
      ? "text-4xl lg:text-5xl max-[900px]:text-3xl"
      : totalHeaderLength <= 80
        ? "text-2xl lg:text-3xl max-[900px]:text-xl"
        : "text-xl lg:text-2xl max-[900px]:text-lg";
  const singerSizeClass =
    totalHeaderLength <= 30
      ? "text-3xl lg:text-4xl max-[900px]:text-2xl"
      : totalHeaderLength <= 80
        ? "text-xl lg:text-2xl max-[900px]:text-lg"
        : "text-lg lg:text-xl max-[900px]:text-base";

  const onPlayerReady: YouTubeProps["onReady"] = (event) => {
    console.log("Player ready", { event });
    // access to player in all event handlers via event.target
    playerRef.current = event.target;
    recordPlayerDiagnostic("player.ready", {
      playerState: getPlayerStateForDiagnostics(event.target),
    });
    setIsReady(true);
  };

  const onPlayerPlay: YouTubeProps["onPlay"] = (event) => {
    console.log("handlePlay");
    recordPlayerDiagnostic("player.play", {
      playerState: getPlayerStateForDiagnostics(event.target),
    });

    setIsPlaying(true);
    void getPlaybackSample().then((sample) => onPlaybackSample?.(sample));
  };

  const onPlayerPause: YouTubeProps["onPause"] = (event) => {
    console.log("handlePause");
    recordPlayerDiagnostic("player.pause", {
      playerState: getPlayerStateForDiagnostics(event.target),
    });
    setIsPlaying(false);
    void getPlaybackSample().then((sample) => onPlaybackSample?.(sample));
  };

  const onPlayerStateChange: YouTubeProps["onStateChange"] = (event) => {
    const nextState = event.data;
    recordPlayerDiagnostic("player.state.changed", {
      previousState: previousPlayerStateRef.current,
      nextState,
      playerState: getPlayerStateForDiagnostics(event.target),
    });
    previousPlayerStateRef.current = nextState;
  };

  const onPlayerError: YouTubeProps["onError"] = (event) => {
    recordPlayerDiagnostic("player.error", {
      errorCode: event.data,
      playerState: getPlayerStateForDiagnostics(event.target),
      youtubeEvent: event,
    });
    setShowOpenInYouTubeButton(true);
  };

  const handlePlayerEnd = () => {
    recordPlayerDiagnostic("player.end", {
      playerState: getPlayerStateForDiagnostics(playerRef.current),
    });
    if (!isWaiting) {
      onPlayerEnded();
    }
  };

  const openYouTubeTab = () => {
    window.open(
      `https://www.youtube.com/watch?v=${video.id}#mykaraokeparty`,
      "_blank",
      "fullscreen=yes"
    );

    if (onPlayerEnded) {
      onPlayerEnded();
    }
  };

  const copyRoomHash = async () => {
    const hash = joinPartyUrl.split("/").pop() ?? "";
    await navigator.clipboard.writeText(hash);
    toast.success("ID copiado", { duration: 3000 });
  };

  if (showOpenInYouTubeButton) {
    return (
      <div
        className={cn(
          "mx-auto flex h-full w-full flex-col items-center justify-between space-y-6 p-4 pb-1 text-center",
          isFullscreen && "bg-gradient"
        )}
      >
        <div className="w-full max-w-4xl">
          <h1
            className={cn(
              "text-outline scroll-m-20 max-w-4xl font-extrabold tracking-tight",
              titleSizeClass
            )}
          >
            {decode(video.title)}
          </h1>
          <h2
            className={cn(
              "text-outline scroll-m-20 font-bold tracking-tight",
              singerSizeClass
            )}
          >
            <MicVocal className="mr-2 inline text-primary" size={32} />
            {video.singerName}
            <MicVocal
              className="ml-2 inline scale-x-[-1] transform text-primary"
              size={32}
            />
          </h2>
        </div>

        <div>
          <h3 className="mb-2 scroll-m-20 text-2xl font-semibold tracking-tight animate-in fade-in zoom-in">
            {esMX.player.embedBlocked}
          </h3>
          <Button
            type="button"
            className="w-fit self-center animate-in fade-in zoom-in"
            onClick={() => openYouTubeTab()}
          >
            {esMX.player.playInYouTube}
            <Youtube className="ml-2" />
          </Button>
          <div className="mt-2">
            <Button
              className="animate-in fade-in zoom-in"
              variant={"secondary"}
              type="button"
              onClick={() => {
                onPlayerEnded();
              }}
            >
              <SkipForward className="mr-2 h-5 w-5" />
              {esMX.player.skip}
            </Button>
          </div>
        </div>

        <div className="relative flex w-full basis-1/4 items-end text-center">
          <div className="relative top-10 flex flex-col items-center">
            <QrCode url={joinPartyUrl} />
            {isPlaying && (
              <span className="font-bold tracking-wide text-white/75">
                {APP_TEXT_BRAND.subtitle}
              </span>
            )}
          </div>
          <a
            href={joinPartyUrl}
            target="_blank"
            className="font-mono text-xl text-white pl-4"
          >
            {joinPartyUrl.split("//")[1]}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-0 h-full">
      <YouTube
        key={video.id}
        loading="eager"
        // className={`h-full w-full`}
        className={`h-full w-full animate-in fade-in ${
          isReady ? "visible" : "invisible"
        }`}
        iframeClassName="w-full h-full"
        // iframeClassName="p2 fixed bottom-0 right-0 h-auto min-h-full w-auto min-w-full"
        videoId={video.id}
        opts={opts}
        onPlay={onPlayerPlay}
        onReady={onPlayerReady}
        onPause={onPlayerPause}
        onError={onPlayerError}
        onEnd={handlePlayerEnd}
        onStateChange={onPlayerStateChange}
      />
      <div
        className={cn(
          "pointer-events-none absolute top-0 w-full text-center animate-in fade-in zoom-in",
          isPlaying || isWaiting ? "hidden" : "block"
        )}
      >
        <div
          className={`flex w-full flex-col items-center justify-center bg-black px-4 py-4 max-[900px]:py-2 ${
            isReady ? "bg-opacity-80" : "bg-opacity-0"
          }`}
        >
          <h1
            className={cn(
              "text-outline scroll-m-20 max-w-4xl font-extrabold tracking-tight",
              titleSizeClass
            )}
          >
            {decode(video.title)}
          </h1>
          <h2
            className={cn(
              "text-outline scroll-m-20 font-bold tracking-tight",
              singerSizeClass
            )}
          >
            <MicVocal className="mr-2 inline text-primary" size={32} />
            {video.singerName}
            <MicVocal
              className="ml-2 inline scale-x-[-1] transform text-primary"
              size={32}
            />
          </h2>
        </div>

        {!isReady && (
          <div>
            <Spinner size={"large"} />
          </div>
        )}
      </div>

      <div className="absolute bottom-12 left-0 z-10 flex w-full flex-row justify-between px-4">
        <div className="relative top-10 flex flex-col items-center">
          <button type="button" onClick={() => void copyRoomHash()}>
            ID Sala: {joinPartyUrl.split("/").pop()}
          </button>
          <QrCode url={joinPartyUrl} />
          {isPlaying && (
            <span className="font-bold tracking-wide text-white/75">
              {APP_TEXT_BRAND.subtitle}
            </span>
          )}
        </div>

        <div
          className={`self-end p-2 ${
            isPlaying && isFullscreen ? "hidden" : "block"
          }`}
        >
          <Button
            // className="bg-yellow-300"
            variant={"secondary"}
            type="button"
            onClick={() => {
              onPlayerEnded();
            }}
          >
            <SkipForward className="mr-2 h-5 w-5" />
            {esMX.player.skip}
          </Button>
          {/* <a
            href={joinPartyUrl}
            target="_blank"
            className="font-mono text-xl text-white"
          >
            {joinPartyUrl.split("//")[1]}
          </a> */}
        </div>
      </div>
    </div>
  );
});
