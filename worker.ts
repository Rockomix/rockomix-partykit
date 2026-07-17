/**
 * ⚠️ ARCHIVO DE REFERENCIA (PartyKit)
 *
 * Este archivo conserva la implementación original basada en PartyKit y se
 * utiliza únicamente como referencia para recuperar comportamiento funcional
 * durante la migración a PartyServer.
 *
 * El procesamiento actual de mensajes se realiza en worker.ts.
 *
 * NOTA:
 * La migración a PartyServer aún no se considera cerrada; worker.ts sigue
 * evolucionando hasta alcanzar paridad funcional con producción.
 *
 * No implementar nuevas funcionalidades en este archivo.
 * Cualquier recuperación de lógica debe realizarse en worker.ts tomando este
 * archivo como referencia.
 */

import { Server } from "../partykit-2026/packages/partyserver/src/index";
import type {
  Connection,
  ConnectionContext,
  WSMessage,
} from "../partykit-2026/packages/partyserver/src/index";
import { z } from "zod";

import { ClientRole, RequestedRole, resolveRole } from "./party/roles";
import {
  canMarkAsPlayed,
  canPause,
  canPlay,
} from "./party/permissions";

function safeParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}


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

const PlaySchema = z.object({
	type: z.literal("play"),
});

const PauseSchema = z.object({
	type: z.literal("pause"),
});

const MessageSchema = z.discriminatedUnion("type", [
	AddVideoSchema,
	RemoveVideoSchema,
	MarkAsPlayedSchema,
	PlaySchema,
	PauseSchema,
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

	override async onConnect(connection: Connection, ctx: ConnectionContext) {
		const url = new URL(ctx.request.url);
		const requestedRole = (url.searchParams.get("role") ?? "guest") as RequestedRole;
		const sessionId = url.searchParams.get("sessionId") ?? undefined;
		const role = await resolveRole(requestedRole, sessionId, this.ctx);

		connection.setState({ role });

		connection.send(
			JSON.stringify({
				type: "connected",
				message: "Rockomix WS OK",
				role,
				playlist: this.karaokeParty?.playlist ?? [],
			}),
		);

		connection.send(
			JSON.stringify({
				type: "role-assigned",
				role,
				...(role === "COHOST"
					? {
						message:
							"🎛️ Eres el cohost de esta fiesta\n\nAhora puedes:\n• Reproducir\n• Pausar\n• Skip",
					}
					: {}),
			}),
		);
	}

	override async onMessage(connection: Connection, message: WSMessage) {

		if (typeof message !== "string") {
			return;
		}

		if (!this.karaokeParty) return;

		const parsed = safeParseJson(message);
		if (!parsed) {
			console.error("[DEBUG B2] Invalid JSON message");
			return;
		}

		const result = MessageSchema.safeParse(parsed);

		if (!result.success) {
			return;
		}

		const data = result.data;
		const state = connection.state as { role?: ClientRole } | null;
		const role = state?.role;

		switch (data.type) {
			case "play": {
				if (!canPlay(role ?? "INVITADO")) {
					return;
				}

				this.broadcast(JSON.stringify(data));
				return;
			}

			case "pause": {
				if (!canPause(role ?? "INVITADO")) {
					return;
				}

				this.broadcast(JSON.stringify(data));
				return;
			}

			case "horn": {
				this.broadcast(JSON.stringify(data));
				return;
			}

			case "add-video": {
				if (
					!this.karaokeParty.playlist.find(
						(video) => video.id === data.id && !video.playedAt,
					)
				) {
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

				await this.ctx.storage.put("karaokeParty", this.karaokeParty);
				this.broadcast(JSON.stringify(this.karaokeParty.playlist));
			}

				return;
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

				return;
			}

			case "mark-as-played": {
				if (!canMarkAsPlayed(role ?? "INVITADO")) {
					return;
				}

				const video = this.karaokeParty.playlist.find(
					(video) => video.id === data.id && !video.playedAt,
				);

				if (video) {
					video.playedAt = new Date();

					await this.ctx.storage.put("karaokeParty", this.karaokeParty);
					this.broadcast(JSON.stringify(this.karaokeParty.playlist));
				}

				return;
			}

			default: {
				return;
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
