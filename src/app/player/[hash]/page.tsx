import { api } from "~/trpc/server";
import { env } from "~/env";
import { notFound } from "next/navigation";
import { type KaraokeParty } from "party";
import PlayerScene from "./player-scene";

type Props = {
  params: { hash: string };
};

export async function generateMetadata({ params }: Props) {
  const partyHash = params.hash;

  const party = await api.party.getByHash({ hash: partyHash });

  if (!party) {
    notFound();
  }

  return {
    title: party.name,
  };
}

export default async function PartyPage({ params }: Props) {
  const partyHash = params.hash;

  const partyPromise = api.party.getByHash({ hash: partyHash });

  const req = fetch(`${env.NEXT_PUBLIC_PARTYKIT_URL}/party/${partyHash}`, {
    method: "GET",
    next: {
      revalidate: 0,
    },
  });

  const [party, partyKitRes] = await Promise.all([partyPromise, req]);

  if (!party) {
    notFound();
  }

  if (!partyKitRes.ok) {
    if (partyKitRes.status === 404) {
      notFound();
    } else {
      throw new Error("Something went wrong.");
    }
  }

  const playlist = (await partyKitRes.json()) as KaraokeParty;

  return <PlayerScene party={party} initialPlaylist={playlist} />;
}
