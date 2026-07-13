import { Server } from "../partykit-2026/packages/partyserver/src/index";
import type { Connection, WSMessage } from "../partykit-2026/packages/partyserver/src/index";
import { z } from "zod";

type VideoInPlaylist = {
	id: string;
	title: string;
	artist: string;
	song: string;
	createdAt: Date;
	singerName: string;
	coverUrl: string;
	playedAt: Date | null;
	duration: string | undefined;
};

type KaraokeParty = {
	playlist: VideoInPlaylist[];
	settings: {
		orderByFairness: boolean;
	};
};

const AddVideoSchema = z.object({
	type: z.literal("add-video"),
	id: z.string(),
	title: z.string(),
	artist: z.string().optional(),
	song: z.string().optional(),
	coverUrl: z.string(),
	duration: z.string().optional(),
	singerName: z.string(),
});

const RemoveVideoSchema = z.object({
	type: z.literal("remove-video"),
	id: z.string(),
});

const MarkAsPlayedSchema = z.object({
	type: z.literal("mark-as-played"),
	id: z.string(),
});

const HornSchema = z.object({
	type: z.literal("horn"),
});

const MessageSchema = z.discriminatedUnion("type", [
	AddVideoSchema,
	RemoveVideoSchema,
	MarkAsPlayedSchema,
	HornSchema,
]);

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

	override async onMessage(_connection: Connection, message: WSMessage) {
		console.log("[B2] onMessage ENTER", {
		messageType: typeof message,
		message,
		});

		if (typeof message !== "string") {
			return;
		}

		if (!this.karaokeParty) return;

		let parsed: unknown;
		try {
			parsed = JSON.parse(message);
		} catch (error) {
			console.error("[DEBUG B2] Invalid JSON message", error);
			return;
		}

			const result = MessageSchema.safeParse(parsed);
			console.log("[B2] safeParse", {
				success: result.success,
			});

		if (!result.success) {
			return;
		}

			const data = result.data;

			switch (data.type) {
				case "add-video": {
					if (
						!this.karaokeParty.playlist.find(
							(video) => video.id === data.id && !video.playedAt
						)
					) {
						console.log("[B2] adding video", data.id);
						this.karaokeParty.playlist.push({
							id: data.id,
							title: data.title,
							artist: "Some artist",
							song: "Song name",
							createdAt: new Date(),
							singerName: data.singerName,
							coverUrl: data.coverUrl,
							playedAt: null,
							duration: data.duration ?? undefined,
						});

						console.log("[B2] before storage");
						await this.ctx.storage.put("karaokeParty", this.karaokeParty);
						console.log("[B2] after storage");

						console.log("[B2] before broadcast");
						this.broadcast(JSON.stringify(this.karaokeParty.playlist));
						console.log("[B2] after broadcast");
					}

					break;
				}

				case "remove-video": {
					const index = this.karaokeParty.playlist.findIndex(
						(video) => video.id === data.id,
					);

					if (index !== -1) {
						this.karaokeParty.playlist.splice(index, 1);
						await this.ctx.storage.put("karaokeParty", this.karaokeParty);
						this.broadcast(JSON.stringify(this.karaokeParty.playlist));
					}

					break;
				}

				case "mark-as-played": {
					const video = this.karaokeParty.playlist.find(
						(video) => video.id === data.id && !video.playedAt,
					);

					if (video) {
						video.playedAt = new Date();

						await this.ctx.storage.put("karaokeParty", this.karaokeParty);
						this.broadcast(JSON.stringify(this.karaokeParty.playlist));
					}

					break;
				}

				case "horn": {
					this.broadcast(JSON.stringify({ type: "horn" }));
					break;
				}
			}
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
