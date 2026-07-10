import { Server } from "../partykit-2026/packages/partyserver/src/index";

type KaraokeParty = {
	playlist: unknown[];
	settings: {
		orderByFairness: boolean;
	};
};

const INITIAL_KARAOKE_PARTY: KaraokeParty = {
	playlist: [],
	settings: {
		orderByFairness: true,
	},
};

export class PartyRoom extends Server {
	karaokeParty: KaraokeParty | undefined;

	override async onStart() {
		this.karaokeParty = await this.ctx.storage.get<KaraokeParty>("karaokeParty");
	}

	override async onRequest(request: Request) {
		if (request.method === "POST" && !this.karaokeParty) {
			this.karaokeParty = INITIAL_KARAOKE_PARTY;
			await this.ctx.storage.put("karaokeParty", this.karaokeParty);
		}

		if (this.karaokeParty) {
			return new Response(JSON.stringify(this.karaokeParty), {
				status: 200,
				headers: {
					"Content-Type": "application/json",
				},
			});
		}

		return new Response("Party not found =(", { status: 404 });
	}
}

interface Env {
	PartyRoom: DurableObjectNamespace<PartyRoom>;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const match = url.pathname.match(/^\/party\/([^/]+)$/);

		if (!match) {
			return new Response("Not Found", { status: 404 });
		}

		const partyHash = match[1];
		const id = env.PartyRoom.idFromName(partyHash);
		const stub = env.PartyRoom.get(id);
		return stub.fetch(new Request(request));
	},
} satisfies ExportedHandler<Env>;
