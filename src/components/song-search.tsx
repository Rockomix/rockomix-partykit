import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { Plus, Search, Check, Loader2, Frown } from "lucide-react";
import type { KaraokeParty } from "party";
import { PreviewPlayer } from "./preview-player";
import { removeBracketedContent } from "~/utils/string";
import { decode } from "html-entities";
import { Input } from "./ui/ui/input";
import { Button } from "./ui/ui/button";
import { Skeleton } from "./ui/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/ui/alert";
import { esMX } from "~/locales/es-MX";
import { recordDiagnostic } from "~/lib/diagnostics";

type Props = {
  onVideoAdded: (videoId: string, title: string, coverUrl: string) => void;
  playlist: KaraokeParty["playlist"];
};

export function SongSearch({ onVideoAdded, playlist }: Props) {
  const [videoInputValue, setVideoInputValue] = useState("");
  const [canFetch, setCanFetch] = useState(false);
  const [includeKaraoke, setIncludeKaraoke] = useState(true);

  const { data, isError, refetch, isLoading, isFetched } =
    api.youtube.search.useQuery(
      {
        keyword: includeKaraoke ? `${videoInputValue} karaoke` : videoInputValue,
      },
      { refetchOnWindowFocus: false, enabled: false, retry: false },
    );

  useEffect(() => {
    if (isFetched) recordDiagnostic({ event: isError ? "song-search.error" : "song-search.success", level: isError ? "error" : "info", component: "SongSearch", context: { resultCount: data?.length ?? 0, queryLength: videoInputValue.length, includeKaraoke } });
  }, [data, includeKaraoke, isError, isFetched, videoInputValue.length]);

  // const [canPlayVideos, setCanPlayVideos] = useState<string[]>([]);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        recordDiagnostic({ event: "song-search.start", component: "SongSearch", context: { queryLength: videoInputValue.length, includeKaraoke } });
        await refetch();
        setCanFetch(false);
      }}
    >
      <div className="flex w-full items-center space-x-2">
        <Input
          type="text"
          name="video-url"
          placeholder={esMX.search.placeholder}
          className="w-full"
          value={videoInputValue}
          onChange={(e) => {
            setVideoInputValue(e.target.value);
            setCanFetch(e.target.value.length >= 3);
          }}
          onFocus={(e) => e.currentTarget.select()}
          required
          minLength={3}
          autoComplete="off"
        />
        <Button type="submit" disabled={isLoading || !canFetch}>
          {isLoading ? (
            <Loader2 className="mx-1 h-6 w-6 animate-spin" />
          ) : (
            <Search className="mx-1 h-6 w-6" />
          )}
        </Button>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-white">
        <input
          type="checkbox"
          checked={includeKaraoke}
          onChange={(e) => setIncludeKaraoke(e.target.checked)}
        />
        <span>Karaoke</span>
      </label>

      {isError && (
        <Alert variant={"destructive"} className="mt-4 bg-red-500 text-white">
          <Frown className="h-4 w-4" color="white" />
          <AlertTitle>{esMX.search.errorTitle}</AlertTitle>
          <AlertDescription>{esMX.search.errorBody}</AlertDescription>
        </Alert>
      )}

      {isFetched && !isError && !data?.length && (
        <Alert className="mt-4">
          <Frown className="h-4 w-4" />
          <AlertTitle>{esMX.search.emptyTitle}</AlertTitle>
          <AlertDescription>
            {esMX.search.emptyBody.replace("{{query}}", videoInputValue)}
          </AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="my-5 flex flex-col space-y-5 overflow-hidden">
          <Skeleton className="h-48 w-full rounded-xl" />

          <Skeleton className="h-48 w-full rounded-xl" />

          <Skeleton className="h-48 w-full rounded-xl" />

          <Skeleton className="h-48 w-full rounded-xl" />

          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      )}

      {data && (
        <div className="my-5 flex flex-col space-y-5 overflow-hidden">
          {data.map((video) => {
            const alreadyAdded = !!playlist.find(
              (v) => v.id === video.id.videoId && !v.playedAt,
            );

            const title = decode(removeBracketedContent(video.snippet.title));

            return (
              <div
                key={video.id.videoId}
                className={"relative h-48 overflow-hidden rounded-lg animate-in fade-in"}
              >
                <PreviewPlayer
                  key={video.id.videoId}
                  videoId={video.id.videoId}
                  title={title}
                  thumbnail={video.snippet.thumbnails.high.url}
                />
                <div className="absolute inset-0 z-10 rounded-lg bg-black opacity-50" />

                <div className="absolute top-0 z-30 w-full rounded-lg opacity-100">
                  <p className="bg-black bg-opacity-70 p-3 text-xl font-bold text-white">
                    {title}
                  </p>
                </div>

                <div className="absolute bottom-3 right-3 z-30 opacity-100 w-full flex justify-between">
                  <div>
                    <p className="bg-black bg-opacity-70 p-2 pl-5 text-sm text-white">
                      {video.snippet.channelTitle}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={"default"}
                    size="icon"
                    className="shadow-xl animate-in spin-in"
                    disabled={alreadyAdded}
                    onClick={() =>
                      (() => {
                        recordDiagnostic({ event: "song-search.add-attempt", component: "SongSearch", context: { videoId: video.id.videoId, hasTitle: Boolean(video.snippet?.title), hasThumbnail: Boolean(video.snippet?.thumbnails?.high?.url) } });
                        try {
                          onVideoAdded(video.id.videoId, removeBracketedContent(video.snippet.title), video.snippet.thumbnails.high.url);
                        } catch (error) {
                          recordDiagnostic({ event: "song-search.add-failed", level: "error", component: "SongSearch", error, context: { videoId: video.id.videoId } });
                          throw error;
                        }
                      })()
                    }
                  >
                    {alreadyAdded ? <Check stroke="pink" /> : <Plus />}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </form>
  );
}
