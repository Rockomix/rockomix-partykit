import "@vidstack/react/player/styles/base.css";

import { useEffect, useRef } from "react";

import {
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
  Poster,
  type MediaPlayerInstance,
  type MediaProviderAdapter,
  type MediaProviderChangeEvent,
} from "@vidstack/react";
import { recordDiagnostic } from "~/lib/diagnostics";

export function PreviewPlayer({
  videoId,
  title,
  thumbnail,
}: {
  videoId: string;
  title: string;
  thumbnail: string;
}) {
  const player = useRef<MediaPlayerInstance>(null);

  useEffect(() => {
    recordDiagnostic({ event: "preview.mount", component: "PreviewPlayer", context: { videoId, hasTitle: Boolean(title), hasThumbnail: Boolean(thumbnail) } });
    recordDiagnostic({ event: "preview.effect.start", component: "PreviewPlayer", context: { videoId, playerCurrent: Boolean(player.current) } });
    // Subscribe to state updates.
    try {
      recordDiagnostic({ event: "preview.subscribe.start", component: "PreviewPlayer", context: { videoId, playerCurrent: Boolean(player.current) } });
      const unsubscribe = player.current!.subscribe(
        ({ paused: _paused, viewType: _viewType }) => {
          // console.log('is paused?', '->', state.paused);
          // console.log('is audio view?', '->', state.viewType === 'audio');
        },
      );
      recordDiagnostic({ event: "preview.subscribe.success", component: "PreviewPlayer", context: { videoId } });
      return () => {
        recordDiagnostic({ event: "preview.unmount", component: "PreviewPlayer", context: { videoId } });
        return unsubscribe();
      };
    } catch (error) {
      recordDiagnostic({ event: "preview.subscribe.failed", level: "error", component: "PreviewPlayer", error, context: { videoId } });
      throw error;
    }
  }, []);

  function onProviderChange(
    provider: MediaProviderAdapter | null,
    _nativeEvent: MediaProviderChangeEvent,
  ) {
    recordDiagnostic({ event: "preview.provider", component: "PreviewPlayer", context: { videoId, provider: provider ? provider.constructor?.name : null } });
    // We can configure provider's here.
    if (isHLSProvider(provider)) {
      provider.config = {};
    }
  }

  // We can listen for the `can-play` event to be notified when the player is ready.
  // function onCanPlay(
  //   detail: MediaCanPlayDetail,
  //   nativeEvent: MediaCanPlayEvent,
  // ) {
  //   console.log("Can play: " + videoId);
  //   canPlay(videoId);
  // }

  return (
    <MediaPlayer
      className="ring-media-focus w-full overflow-hidden rounded-md bg-slate-900 font-sans text-white data-[focus]:ring-4"
      title={title}
      src={`youtube/${videoId}`}
      crossOrigin
      playsInline
      onProviderChange={onProviderChange}
      ref={player}
      load="custom"
      posterLoad="eager"
    >
      <MediaProvider>
        <Poster
          className="absolute inset-0 block h-full w-full rounded-md object-cover opacity-0 transition-opacity data-[visible]:opacity-100"
          src={thumbnail}
          alt={title}
        />
      </MediaProvider>
    </MediaPlayer>
  );
}
