import JoinScene from "../join-scene";

export default async function JoinPartyHashPage({
  params,
}: {
  params: { hash: string };
}) {
  const partyHash = params.hash;

  return <JoinScene partyHash={partyHash} />;
}
