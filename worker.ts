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

import { Server } from "partyserver";
import type {
  Connection,
  ConnectionContext,
  WSMessage,
} from "partyserver";
import { z } from "zod";

import { resolveRole } from "./party/roles";
import type { ClientRole, RequestedRole } from "./party/roles";
import {
  canMarkAsPlayed,
  canManagePlaylist,
  canPause,
  canPlay,
  canRate,
  canResetSong,
  canToggleFairQueue,
} from "./party/permissions";
import { orderByFairness } from "~/utils/array";
import { chooseRatingPhrase, generateRatingScore } from "~/utils/rating";
import { getQueueIndexes, moveInQueue } from "~/utils/playlist";
import type { PlaylistOperationResult } from "~/shared/party-types";

function safeParseJson(value: string): unknown {
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

const ResetSongSchema = z.object({
	type: z.literal("reset-song"),
	id: z.string(),
});

const ToggleFullscreenSchema = z.object({
	type: z.literal("toggle-fullscreen"),
});

const RatingRequestSchema = z.object({
	type: z.literal("rating-request"),
	songId: z.string().optional(),
	requestId: z.string(),
});

const MoveVideoSchema = z.object({
  type: z.literal("move-video"),
  requestId: z.string().min(1),
  id: z.string(),
  toIndex: z.number().int().nonnegative(),
});

const SetFairQueueSchema = z.object({
  type: z.literal("set-fair-queue"),
  requestId: z.string().min(1),
  enabled: z.boolean(),
});

const MessageSchema = z.discriminatedUnion("type", [
	AddVideoSchema,
	RemoveVideoSchema,
	MarkAsPlayedSchema,
	PlaySchema,
	PauseSchema,
	ResetSongSchema,
	ToggleFullscreenSchema,
	HornSchema,
	RatingRequestSchema,
  MoveVideoSchema,
  SetFairQueueSchema,
]);

const INITIAL_KARAOKE_PARTY: KaraokeParty = {
	playlist: [],
	settings: {
		orderByFairness: true,
	},
};

export class PartyRoom extends Server {
	karaokeParty: KaraokeParty | undefined;
	activeRatingId: string | null = null;
	activeRatingExpiresAt = 0;
	private messageQueue: Promise<void> = Promise.resolve();

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

		// 👇 LOG TEMPORAL AQUÍ
		/*console.log({
		url: ctx.request.url,
		requestedRole,
		sessionId,
		role,
		});*/

		

		connection.setState({ role });

		connection.send(
			JSON.stringify({
				type: "connected",
				message: "Rockomix WS OK",
				role,
				playlist: this.karaokeParty?.playlist ?? [],
					settings: this.karaokeParty?.settings ?? INITIAL_KARAOKE_PARTY.settings,
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

			const previousMessage = this.messageQueue;
			let releaseMessage!: () => void;
			this.messageQueue = new Promise<void>((resolve) => {
				releaseMessage = resolve;
			});

			await previousMessage;

			try {
			const parsed = safeParseJson(message);
		if (!parsed) {
			console.error("[DEBUG B2] Invalid JSON message");
			return;
		}

		const result = MessageSchema.safeParse(parsed);

		if (!result.success) {
				const candidate = parsed as {
					type?: unknown;
					requestId?: unknown;
				};
				if (
					(candidate.type === "move-video" ||
						candidate.type === "set-fair-queue") &&
					typeof candidate.requestId === "string"
				) {
					this.sendPlaylistOperationResult(connection, {
						requestId: candidate.requestId,
						operation: candidate.type,
						accepted: false,
						reason: "invalid-payload",
					});
				}
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

			case "reset-song": {
				if (!canResetSong(role ?? "INVITADO")) {
					return;
				}

				const activeVideo = this.karaokeParty.playlist.find(
					(video) => !video.playedAt,
				);

				if (!activeVideo || activeVideo.id !== data.id) {
					return;
				}

				this.broadcast(JSON.stringify(data));
				return;
			}

			case "toggle-fullscreen": {
				if (!canPlay(role ?? "INVITADO")) {
					return;
				}

				this.broadcast(JSON.stringify(data));
				return;
			}

			case "horn": {
				this.broadcast(JSON.stringify(data));
				return;
			}

			case "rating-request": {
				if (this.activeRatingId && Date.now() >= this.activeRatingExpiresAt) {
					this.activeRatingId = null;
					this.activeRatingExpiresAt = 0;
				}

				if (!canRate(role ?? "INVITADO") || this.activeRatingId) {
					return;
				}

				const activeVideo = this.karaokeParty.playlist.find(
					(video) => !video.playedAt,
				);

				const ratingId = `${data.requestId}-${Date.now()}`;
				this.activeRatingId = ratingId;
				this.activeRatingExpiresAt = Date.now() + 5000;
				const score = generateRatingScore();
				this.broadcast(
					JSON.stringify({
						type: "rating-result",
						ratingId,
						songId: activeVideo?.id ?? null,
						singerName: activeVideo?.singerName ?? "",
						title: activeVideo?.title ?? "",
						score,
						phrase: chooseRatingPhrase(score),
					}),
				);

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

						// IMPORTANTE:
						// Esta lógica replica el comportamiento de Producción 1.0.
						// No reemplazar por la variante del worker moderno.
						// La canción actual debe conservarse y solo se reordenan las canciones pendientes.
							if (this.karaokeParty.settings.orderByFairness) {
								const ordered = orderByFairness(
									this.karaokeParty.playlist,
									(video) => video.singerName,
									(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
								);

							const playedVideos = this.karaokeParty.playlist.filter(
								(video) => video.playedAt,
							);
							const currentVideo = this.karaokeParty.playlist.find(
								(video) => !video.playedAt,
							);
							const nextVideos = ordered.filter(
								(video) => !video.playedAt && video !== currentVideo,
							);

							const newPlaylist = [...playedVideos];

							if (currentVideo) {
								newPlaylist.push(currentVideo);
								}

								newPlaylist.push(...nextVideos);

								this.karaokeParty.playlist = newPlaylist;
						}

				await this.ctx.storage.put("karaokeParty", this.karaokeParty);
				this.broadcastPlaylistState();
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
					this.broadcastPlaylistState();
				}

				return;
			}

			case "move-video": {
				if (!canManagePlaylist(role ?? "INVITADO")) {
					this.sendPlaylistOperationResult(connection, {
						requestId: data.requestId,
						operation: data.type,
						accepted: false,
						reason: "unauthorized",
					});
					return;
				}

				const playlist = this.karaokeParty.playlist;
				const video = playlist.find((item) => item.id === data.id);
				if (!video) {
					this.sendPlaylistOperationResult(connection, {
						requestId: data.requestId,
						operation: data.type,
						accepted: false,
						reason: "video-not-found",
					});
					return;
				}

				if (video.playedAt) {
					this.sendPlaylistOperationResult(connection, {
						requestId: data.requestId,
						operation: data.type,
						accepted: false,
						reason: "video-already-played",
					});
					return;
				}

				const queueIndexes = getQueueIndexes(playlist);
				const from = queueIndexes.findIndex(
					(index) => playlist[index]?.id === data.id,
				);
				if (from === 0) {
					this.sendPlaylistOperationResult(connection, {
						requestId: data.requestId,
						operation: data.type,
						accepted: false,
						reason: "current-video-protected",
					});
					return;
				}

				const reordered = moveInQueue(playlist, data.id, data.toIndex);
				if (reordered === playlist) {
					this.sendPlaylistOperationResult(connection, {
						requestId: data.requestId,
						operation: data.type,
						accepted: false,
						reason: "no-change",
					});
					return;
				}

				this.karaokeParty.playlist = reordered;
				this.karaokeParty.settings.orderByFairness = false;
				await this.ctx.storage.put("karaokeParty", this.karaokeParty);
				this.sendPlaylistOperationResult(connection, {
					requestId: data.requestId,
					operation: data.type,
					accepted: true,
				});
				this.broadcastPlaylistState();
				return;
			}

			case "set-fair-queue": {
				if (!canToggleFairQueue(role ?? "INVITADO")) {
					this.sendPlaylistOperationResult(connection, {
						requestId: data.requestId,
						operation: data.type,
						accepted: false,
						reason: "unauthorized",
					});
					return;
				}

				if (this.karaokeParty.settings.orderByFairness !== data.enabled) {
					this.karaokeParty.settings.orderByFairness = data.enabled;
					if (data.enabled) {
						this.reorderPlaylistByFairness();
					}
					await this.ctx.storage.put("karaokeParty", this.karaokeParty);
				}

				this.sendPlaylistOperationResult(connection, {
					requestId: data.requestId,
					operation: data.type,
					accepted: true,
				});
				this.broadcastPlaylistState();
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
					this.broadcastPlaylistState();
				}

				return;
			}

			default: {
				return;
			}
			}
			} finally {
				releaseMessage();
			}
		}

		reorderPlaylistByFairness() {
			if (!this.karaokeParty || this.karaokeParty.playlist.length === 0) {
				return;
			}

			const ordered = orderByFairness(
				this.karaokeParty.playlist,
				(video) => video.singerName,
				(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
			);
			const playedVideos = this.karaokeParty.playlist.filter(
				(video) => video.playedAt,
			);
			const currentVideo = this.karaokeParty.playlist.find(
				(video) => !video.playedAt,
			);
			const nextVideos = ordered.filter(
				(video) => !video.playedAt && video !== currentVideo,
			);

			const newPlaylist = [...playedVideos];
			if (currentVideo) newPlaylist.push(currentVideo);
			newPlaylist.push(...nextVideos);
			this.karaokeParty.playlist = newPlaylist;
		}

		sendPlaylistOperationResult(
			connection: Connection,
			result: Omit<PlaylistOperationResult, "type">,
		) {
			connection.send(
				JSON.stringify({
					type: "playlist-operation-result",
					...result,
				}),
			);
		}

		broadcastPlaylistState() {
			if (!this.karaokeParty) return;

			this.broadcast(JSON.stringify(this.karaokeParty.playlist));
			this.broadcast(
				JSON.stringify({
					type: "settings",
					settings: this.karaokeParty.settings,
				}),
			);
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
		if (!partyHash) {
			return new Response("Not Found", { status: 404 });
		}

		const id = env.PartyRoom.idFromName(partyHash);
		const stub = env.PartyRoom.get(id);
		return stub.fetch(new Request(request));
	},
} satisfies ExportedHandler<Env>;
