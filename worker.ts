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
import type {
  PlaylistOperationResult,
  SoundPadConfig,
} from "~/shared/party-types";
import { SOUND_FILE_PATHS } from "~/generated/sound-inventory";

const AUTHORIZED_SOUND_PATHS = new Set<string>(SOUND_FILE_PATHS);

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
	soundId: z.string().optional(),
});

const SoundPadMessageSchema = z.object({
	type: z.literal("soundpad"),
	soundId: z.string().regex(/^\d{3}$/, "soundId must contain three digits"),
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

const SoundPadAssignmentSchema = z.object({
  padId: z.number().int(),
  soundId: z.string().regex(/^\d{3}$/).nullable(),
  soundPath: z.string().nullable().optional(),
  volume: z.number().min(0).max(1),
});

const SoundPadConfigSchema = z
  .object({
    version: z.literal(1),
    assignments: z.array(SoundPadAssignmentSchema).length(16),
  })
  .superRefine((config, context) => {
    const padIds = new Set<number>();

    for (const [index, assignment] of config.assignments.entries()) {
      if (assignment.padId < 1 || assignment.padId > 16) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assignments", index, "padId"],
          message: "padId must be between 1 and 16",
        });
      }

      if (padIds.has(assignment.padId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assignments", index, "padId"],
          message: "Duplicate padId",
        });
      }

      padIds.add(assignment.padId);

      const soundId = assignment.soundId;
      const hasSoundId = typeof soundId === "string";
      const hasSoundPath = typeof assignment.soundPath === "string";

      if (hasSoundPath && !AUTHORIZED_SOUND_PATHS.has(assignment.soundPath!)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assignments", index, "soundPath"],
          message: "Sound path is not in the generated inventory",
        });
      }

      if (!hasSoundId && !hasSoundPath && assignment.soundId !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assignments", index],
          message: "Assignment must contain a sound reference or null",
        });
      }

      if (
        assignment.padId === 4 &&
        (assignment.soundId !== null || assignment.soundPath != null || assignment.volume !== 1)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assignments", index],
          message: "Pad 4 is reserved and cannot be assigned",
        });
      }
    }

    for (let padId = 1; padId <= 16; padId += 1) {
      if (!padIds.has(padId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assignments"],
          message: `Missing padId ${padId}`,
        });
      }
    }
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
	SoundPadMessageSchema,
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

const SOUND_PAD_STORAGE_KEY = "soundPad";
const SOUND_PAD_GENERAL_STORAGE_KEY = "soundPadGeneral";

function normalizeStoredSoundPadConfig(value: unknown): SoundPadConfig | null {
	if (
		typeof value !== "object" ||
		value === null ||
		!Array.isArray((value as { assignments?: unknown }).assignments)
	) {
		return null;
	}

	const assignments = (value as { assignments: unknown[] }).assignments;
	if (assignments.length !== 16) return null;

	return {
		version: 1,
		assignments: assignments.map((rawAssignment, index) => {
			const raw = (rawAssignment ?? {}) as {
				padId?: unknown;
				soundId?: unknown;
				soundPath?: unknown;
				volume?: unknown;
			};
			const padId =
				typeof raw.padId === "number" && Number.isInteger(raw.padId)
					? raw.padId
					: index + 1;
			const soundPath =
				typeof raw.soundPath === "string" || raw.soundPath === null
					? raw.soundPath
					: null;
			const soundId =
				typeof raw.soundId === "string" && /^\d{3}$/.test(raw.soundId)
					? raw.soundId
					: typeof raw.soundId === "number" &&
					    Number.isInteger(raw.soundId) &&
					    raw.soundId >= 0 &&
					    raw.soundId <= 999
					  ? String(raw.soundId).padStart(3, "0")
					  : soundPath
					    ? String(padId).padStart(3, "0")
					    : null;

			return {
				padId,
				soundId,
				soundPath,
				volume:
					typeof raw.volume === "number" && Number.isFinite(raw.volume)
						? raw.volume
						: 1,
			};
		}),
	};
}

function createInitialSoundPadConfig(): SoundPadConfig {
  return {
    version: 1,
    assignments: Array.from({ length: 16 }, (_, index) => ({
      padId: index + 1,
      soundId: null,
      soundPath: null,
      volume: 1,
    })),
  };
}

function soundPadResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      ...extraHeaders,
    },
  });
}

export class PartyRoom extends Server {
	karaokeParty: KaraokeParty | undefined;
	activeRatingId: string | null = null;
	activeRatingExpiresAt = 0;
	private messageQueue: Promise<void> = Promise.resolve();

	override async onStart() {
		this.karaokeParty = await this.ctx.storage.get<KaraokeParty>("karaokeParty");
	}

	override async onRequest(request: Request) {
		const url = new URL(request.url);

		const resource = url.searchParams.get("resource");

		if (resource === "soundPad" || resource === "soundPadGeneral") {
			const storageKey =
				resource === "soundPadGeneral"
					? SOUND_PAD_GENERAL_STORAGE_KEY
					: SOUND_PAD_STORAGE_KEY;

			if (request.method === "OPTIONS") {
				return soundPadResponse(null, 204);
			}

			if (request.method === "GET") {
					const storedValue = await this.ctx.storage.get<unknown>(
					storageKey,
				);
					const storedConfig = normalizeStoredSoundPadConfig(storedValue);
					if (
						storedConfig &&
						JSON.stringify(storedValue) !== JSON.stringify(storedConfig)
					) {
						await this.ctx.storage.put(storageKey, storedConfig);
					}
				return soundPadResponse(
						storedConfig ?? createInitialSoundPadConfig(),
					200,
						{ "X-Sound-Pad-Exists": storedValue ? "true" : "false" },
				);
			}

			if (request.method === "PUT") {
				let payload: unknown;

				try {
					payload = await request.json();
				} catch {
					return soundPadResponse({ error: "Invalid JSON payload" }, 400);
				}

				const result = SoundPadConfigSchema.safeParse(payload);
				if (!result.success) {
					return soundPadResponse(
						{
							error: "Invalid Sound Pad configuration",
							issues: result.error.issues,
						},
						400,
					);
				}

					const existingConfig = normalizeStoredSoundPadConfig(
						await this.ctx.storage.get<unknown>(storageKey),
					);
					const incomingByPadId = new Map(
						result.data.assignments.map((assignment) => [assignment.padId, assignment]),
					);
					const mergedConfig: SoundPadConfig = {
						version: 1,
						assignments: (existingConfig?.assignments ?? result.data.assignments).map(
							(existingAssignment) => ({
								...existingAssignment,
								...(incomingByPadId.get(existingAssignment.padId) ?? {}),
							}),
						),
					};
					await this.ctx.storage.put(storageKey, mergedConfig);
					return soundPadResponse(mergedConfig);
			}

			return soundPadResponse({ error: "Method not allowed" }, 405);
		}

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

			case "soundpad": {
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

		if (url.pathname === "/soundpad") {
			const id = env.PartyRoom.idFromName("__soundpad-general__");
			const stub = env.PartyRoom.get(id);
			return stub.fetch(new Request(request));
		}

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
