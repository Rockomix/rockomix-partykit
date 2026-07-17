/* eslint-disable */
"use client";

import type { Party } from "@prisma/client";
import type { Message, KaraokeParty } from "party";
import { useEffect, useState, useRef } from "react";
import { env } from "~/env";
import { readLocalStorageValue, useLocalStorage } from "@mantine/hooks";
import { SongSearch } from "~/components/song-search";
import { ListMusic, Megaphone, Pause, Play, SkipForward } from "lucide-react";
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

  useEffect(() => {
    const value = readLocalStorageValue({ key: "name" });

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

  const addSong = async (videoId: string, title: string, coverUrl: string) => {
    socket.send(
      JSON.stringify({
        type: "add-video",
        id: videoId,
        title,
        singerName: name,
        coverUrl,
      } satisfies Message),
    );
  };

  const sendHorn = async () => {
    socket.send(
      JSON.stringify({
        type: "horn",
      } satisfies Message),
    );
  };

  const nextVideos = playlist.filter((video) => !video.playedAt);
  const nextVideo = nextVideos[0] ?? null;

  return (
    <>
      <div className="container mx-auto p-6 pb-16 text-center">
        <div className="mx-auto flex w-full flex-col items-center gap-4 md:w-1/3 md:items-start md:gap-3">
          <div className="flex items-center justify-center">
            <AppTextBrand />
          </div>

          <h1 className="text-outline scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl">
            Fiesta de {party.name}
          </h1>

          <div className="inline-flex flex-wrap items-center gap-2 text-lg font-semibold text-white/90 md:justify-start">
            <span>👋 ¡Hola, {hostName}!</span>
            {role === "INVITADO" ? (
              <span className="text-white">🙂</span>
            ) : null}
          </div>

          {role === "COHOST" ? (
            <div className="mt-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 md:justify-start">
              <span className="text-emerald-400">🟢</span>
              <span>CO HOST</span>
            </div>
          ) : null}

          <div className="w-full md:w-full">
            <SongSearch onVideoAdded={addSong} playlist={playlist} />
          </div>
        </div>
      </div>

      <div className="fixed bottom-16 left-1/2 transform -translate-x-1/2 z-[100]">
        <button
          type="button"
          className="rounded-full bg-yellow-200 p-2 text-black hover:text-white hover:bg-red-700 shadow-lg"
          onClick={sendHorn}
        >
          <Megaphone size={32} />
        </button>
      </div>

      {role === "COHOST" && (
        <div className="fixed bottom-28 left-1/2 z-[100] -translate-x-1/2">
          <div className="flex gap-2 rounded-full bg-black/70 p-2 shadow-xl backdrop-blur">
            <button type="button" className="btn btn-secondary" onClick={() => sendSocketMessage({ type: "play" } as Message)}>
              <Play className="mr-2 h-4 w-4" />
              Reproducir
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => sendSocketMessage({ type: "pause" } as Message)}>
              <Pause className="mr-2 h-4 w-4" />
              Pausar
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => sendSocketMessage({ type: "mark-as-played", id: nextVideo?.id ?? "" } as Message)} disabled={!nextVideo}>
              <SkipForward className="mr-2 h-4 w-4" />
              Skip
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 z-50 flex flex-col w-full items-center bg-primary p-2 text-primary-foreground text-white">
        <Accordion type="single" collapsible className="max-h-screen w-full">
          <AccordionItem value="item-1" className="border-0">
            <AccordionTrigger disabled={nextVideos.length < 2}>
              <div className="flex flex-row">
                <ListMusic className="mr-3" />
                {nextVideo ? nextVideo.title : esMX.party.playlistEmpty}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="divide-y divide-accent-foreground">
                {nextVideos.slice(1).map((video) => (
                  <li key={video.id} className="p-2 first:pt-0 last:pb-0">
                    {decode(video.title)}
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
