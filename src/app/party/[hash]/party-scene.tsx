/* eslint-disable */
"use client";

import type { Party } from "@prisma/client";
import type { Message, KaraokeParty } from "party";
import { useEffect, useState, useRef } from "react";
import { env } from "~/env";
import { readLocalStorageValue, useLocalStorage } from "@mantine/hooks";
import { SongSearch } from "~/components/song-search";
import {
  ListMusic,
  Maximize,
  Megaphone,
  Pause,
  Play,
  Share2,
  SkipForward,
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
  const [hostName, setHostName] = useState(party.name);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const [isBrandScrolled, setIsBrandScrolled] = useState(false);

  useEffect(() => {
    const content = contentScrollRef.current;

    if (!content) {
      return;
    }

    const handleScroll = () => {
      setIsBrandScrolled(content.scrollTop > 4);
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

        if (Array.isArray(eventData)) {
          setPlaylist(eventData);
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    },
  });

  const sendSocketMessage = (message: Message) => {
    socket.send(JSON.stringify(message));
  };

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

  const sendToggleFullscreen = () => {
    sendSocketMessage({ type: "toggle-fullscreen" } satisfies Message);
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
              <div className="flex w-full items-center justify-between gap-3">
                <h1
                  className={`text-outline scroll-m-20 whitespace-nowrap font-extrabold tracking-tight ${getTitleSizeClass(party.name)}`}
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

      <div className="fixed bottom-16 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-8 rounded-full bg-black/70 p-3 shadow-xl backdrop-blur">
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
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-secondary" onClick={sendPlay}>
              <Play className="mr-2 h-4 w-4" />
            </button>
            <button type="button" className="btn btn-secondary" onClick={sendPause}>
              <Pause className="mr-2 h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={sendSkip}
              disabled={!nextVideo}
            >
              <SkipForward className="mr-2 h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={sendToggleFullscreen}
            >
              <Maximize className="mr-2 h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 z-50 flex flex-col w-full items-center bg-primary p-2 text-primary-foreground text-white">
        <Accordion type="single" collapsible className="max-h-screen w-full">
          <AccordionItem value="item-1" className="border-0">
            <AccordionTrigger disabled={nextVideos.length < 2}>
              <div className="flex min-w-0 flex-row items-center">
                <ListMusic className="mr-3" />
                {nextVideo ? (
                  <span className="mr-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-white/90">
                    <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                  </span>
                ) : null}
                {nextVideo ? (
                  <div className="min-w-0 text-left">
                    <div className="truncate">{nextVideo.title}</div>
                    {nextVideo.singerName ? (
                      <div className="truncate text-sm font-normal text-white/70">
                        {nextVideo.singerName}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  esMX.party.playlistEmpty
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="divide-y divide-accent-foreground">
                {nextVideos.slice(1).map((video) => (
                  <li key={video.id} className="p-2 first:pt-0 last:pb-0">
                    <div className="min-w-0 text-left">
                      <div className="truncate">{decode(video.title)}</div>
                      {video.singerName ? (
                        <div className="truncate text-sm font-normal text-white/70">
                          {video.singerName}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
}
