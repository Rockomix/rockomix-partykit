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
	  PlaybackState,
  SoundInventoryRecord,
  SoundPadConfig,
} from "~/shared/party-types";
import { SOUND_FILE_PATHS } from "~/generated/sound-inventory";
import { normalizeSoundPath, reconcileSoundInventory, soundFileName } from "~/shared/sound-inventory-rules.mjs";
import { SOUND_BY_ID } from "~/constants/audio";

const AUTHORIZED_SOUND_PATHS = new Set<string>([...SOUND_FILE_PATHS, ...Object.values(SOUND_BY_ID)]);

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

const PlaybackStateSchema = z.object({
	type: z.literal("playback-state"),
	id: z.string(),
	playing: z.boolean(),
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

const createSoundPadConfigSchema = (authorizedSoundPaths: Set<string>) => z
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

      if (hasSoundPath && !authorizedSoundPaths.has(assignment.soundPath!)) {
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
	PlaybackStateSchema,
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
const SOUND_INVENTORY_STORAGE_KEY = "soundInventory";

function normalizeSoundInventory(value: unknown): SoundInventoryRecord[] {
	if (typeof value !== "object" || value === null || !Array.isArray((value as { records?: unknown }).records)) return [];
	const records = (value as { records: unknown[] }).records;
	const seenIds = new Set<string>();
	const seenPaths = new Set<string>();
	const normalized: SoundInventoryRecord[] = [];
	for (const rawValue of records) {
		if (typeof rawValue !== "object" || rawValue === null) continue;
		const raw = rawValue as Partial<SoundInventoryRecord>;
		const path = typeof raw.path === "string" ? normalizeSoundPath(raw.path) : null;
		if (!path || typeof raw.soundId !== "string" || !/^\d{3}$/.test(raw.soundId) || seenIds.has(raw.soundId) || seenPaths.has(path)) continue;
		seenIds.add(raw.soundId);
		seenPaths.add(path);
		normalized.push({ soundId: raw.soundId, path, name: typeof raw.name === "string" ? raw.name : soundFileName(path), available: raw.available === true });
	}
	return normalized;
}

async function getStoredSoundInventory(storage: DurableObjectStorage): Promise<SoundInventoryRecord[]> {
	return normalizeSoundInventory(await storage.get<unknown>(SOUND_INVENTORY_STORAGE_KEY));
}

function normalizeStoredSoundPadConfig(value: unknown, inventory: SoundInventoryRecord[] = []): SoundPadConfig | null {
	if (
		typeof value !== "object" ||
		value === null ||
		!Array.isArray((value as { assignments?: unknown }).assignments)
	) {
		return null;
	}

	const assignments = (value as { assignments: unknown[] }).assignments;
	if (assignments.length !== 16) return null;
	const idByPath = new Map(inventory.map((record) => [record.path, record.soundId]));
	for (const [soundId, soundPath] of Object.entries(SOUND_BY_ID)) idByPath.set(soundPath, soundId);

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
			const pathSoundId = soundPath ? idByPath.get(soundPath) : undefined;
			const legacySoundId =
				typeof raw.soundId === "string" && /^\d{3}$/.test(raw.soundId)
					? raw.soundId
					: typeof raw.soundId === "number" && Number.isInteger(raw.soundId) && raw.soundId >= 0 && raw.soundId <= 999
						? String(raw.soundId).padStart(3, "0")
						: null;
			const soundId = pathSoundId ?? legacySoundId;

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
      "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...extraHeaders,
    },
  });
}

export class PartyRoom extends Server {
	karaokeParty: KaraokeParty | undefined;
	activeRatingId: string | null = null;
	activeRatingExpiresAt = 0;
	playbackState: PlaybackState | null = null;
	private messageQueue: Promise<void> = Promise.resolve();

	override async onStart() {
		this.karaokeParty = await this.ctx.storage.get<KaraokeParty>("karaokeParty");
	}

	override async onRequest(request: Request) {
		const url = new URL(request.url);

		const resource = url.searchParams.get("resource");

		if (resource === "soundInventory") {
			if (request.method === "OPTIONS") return soundPadResponse(null, 204);
			if (request.method !== "GET") return soundPadResponse({ error: "Method not allowed" }, 405);
			return soundPadResponse({ records: await getStoredSoundInventory(this.ctx.storage), source: "durable-object" });
		}

		if (resource === "soundInventoryScan" || resource === "soundInventorySync") {
			if (request.method === "OPTIONS") return soundPadResponse(null, 204);
			if (request.method !== "POST") return soundPadResponse({ error: "Method not allowed" }, 405);

			let discoveredPaths: unknown = SOUND_FILE_PATHS;
			let previousRecords: SoundInventoryRecord[] = [];
			let isCompleteScan = false;
			if (resource === "soundInventorySync") {
				try {
					const payload = await request.json() as { paths?: unknown; previousRecords?: unknown; isCompleteScan?: unknown };
					discoveredPaths = payload.paths;
					isCompleteScan = payload.isCompleteScan === true;
					if (payload.previousRecords !== undefined) {
						if (!Array.isArray(payload.previousRecords)) return soundPadResponse({ error: "Invalid inventory manifest" }, 400);
						previousRecords = payload.previousRecords as SoundInventoryRecord[];
					}
				} catch {
					return soundPadResponse({ error: "Invalid JSON payload" }, 400);
				}
			}
			if (!Array.isArray(discoveredPaths)) return soundPadResponse({ error: "Invalid sound paths" }, 400);
			const normalizedPaths: string[] = [];
			for (const rawPath of discoveredPaths) {
				if (typeof rawPath !== "string") return soundPadResponse({ error: "Invalid sound path" }, 400);
				const normalizedPath = normalizeSoundPath(rawPath);
				if (!normalizedPath || normalizedPath !== rawPath) return soundPadResponse({ error: `Invalid sound path: ${rawPath}` }, 400);
				normalizedPaths.push(normalizedPath);
			}

			const storedRecords = await getStoredSoundInventory(this.ctx.storage);
			if (!isCompleteScan) {
				for (const record of storedRecords) {
					if (record.available) normalizedPaths.push(record.path);
				}
			}
			if (resource === "soundInventorySync") {
				const storedByPath = new Map(storedRecords.map((record) => [record.path, record]));
				const storedById = new Map(storedRecords.map((record) => [record.soundId, record.path]));
				const incomingByPath = new Map<string, string>();
				const incomingById = new Map<string, string>();
				const highestStoredId = Math.max(0, ...storedRecords.map((record) => Number(record.soundId)));
				if (previousRecords.length > 999) return soundPadResponse({ error: "SoundID capacity exceeded" }, 409);
				for (const rawRecord of previousRecords) {
					if (!rawRecord || typeof rawRecord !== "object" || typeof rawRecord.soundId !== "string" || !/^\d{3}$/.test(rawRecord.soundId) || typeof rawRecord.path !== "string" || typeof rawRecord.name !== "string" || typeof rawRecord.available !== "boolean") {
						return soundPadResponse({ error: "Invalid sound inventory record" }, 400);
					}
					const path = normalizeSoundPath(rawRecord.path);
					if (!path || path !== rawRecord.path) return soundPadResponse({ error: "Invalid sound inventory path" }, 400);
					if ((incomingByPath.has(path) && incomingByPath.get(path) !== rawRecord.soundId) || (incomingById.has(rawRecord.soundId) && incomingById.get(rawRecord.soundId) !== path)) {
						return soundPadResponse({ error: "Duplicate sound ID or path in manifest" }, 400);
					}
					incomingByPath.set(path, rawRecord.soundId);
					incomingById.set(rawRecord.soundId, path);
					const knownPath = storedByPath.get(path);
					const knownIdPath = storedById.get(rawRecord.soundId);
					if ((knownPath && knownPath.soundId !== rawRecord.soundId) || (knownIdPath && knownIdPath !== path)) {
						return soundPadResponse({ error: `SoundID conflict for ${path}; the stored inventory was left unchanged.` }, 409);
					}
					if (!knownPath && Number(rawRecord.soundId) <= highestStoredId && SOUND_BY_ID[rawRecord.soundId as keyof typeof SOUND_BY_ID] !== path) {
						return soundPadResponse({ error: `SoundID ${rawRecord.soundId} cannot be reused.` }, 409);
					}
				}
			}

			const previous = [...storedRecords, ...previousRecords];
			let reconciled;
			try {
				reconciled = reconcileSoundInventory(previous, normalizedPaths, SOUND_BY_ID);
			} catch (error) {
				return soundPadResponse({ error: error instanceof Error ? error.message : "No se pudo reconciliar el inventario." }, 409);
			}
			const previouslyKnownPaths = new Set([...storedRecords.map((record) => record.path), ...Object.values(SOUND_BY_ID)]);
			const newCount = [...new Set(normalizedPaths)].filter((path) => !previouslyKnownPaths.has(path)).length;
			await this.ctx.storage.put(SOUND_INVENTORY_STORAGE_KEY, { version: 1, records: reconciled.records });
			return soundPadResponse({
				records: reconciled.records,
				found: new Set(normalizedPaths).size,
				newCount,
				existingCount: new Set(normalizedPaths).size - newCount,
				absentCount: reconciled.absent.length,
				source: resource === "soundInventoryScan" ? "build-snapshot" : "local-filesystem",
			});
		}

		if (resource === "soundPad" || resource === "soundPadGeneral") {
			const storageKey =
				resource === "soundPadGeneral"
					? SOUND_PAD_GENERAL_STORAGE_KEY
					: SOUND_PAD_STORAGE_KEY;
			const soundInventory = await getStoredSoundInventory(this.ctx.storage);

			if (request.method === "OPTIONS") {
				return soundPadResponse(null, 204);
			}

			if (request.method === "GET") {
					const storedValue = await this.ctx.storage.get<unknown>(
					storageKey,
				);
					const storedConfig = normalizeStoredSoundPadConfig(storedValue, soundInventory);
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

				const authorizedPaths = new Set([...AUTHORIZED_SOUND_PATHS, ...soundInventory.map((record) => record.path)]);
				const result = createSoundPadConfigSchema(authorizedPaths).safeParse(payload);
				if (!result.success) {
					return soundPadResponse(
						{
							error: "Invalid Sound Pad configuration",
							issues: result.error.issues,
						},
						400,
					);
				}

					const existingValue = await this.ctx.storage.get<unknown>(storageKey);
					const existingConfig = normalizeStoredSoundPadConfig(existingValue, soundInventory);
					const inventoryByPath = new Map(soundInventory.map((record) => [record.path, record]));
					for (const [soundId, soundPath] of Object.entries(SOUND_BY_ID)) {
						inventoryByPath.set(soundPath, { soundId, path: soundPath, name: soundFileName(soundPath), available: true });
					}
					for (const assignment of result.data.assignments) {
						if (!assignment.soundPath && !assignment.soundId) continue;
						const registered = assignment.soundPath ? inventoryByPath.get(assignment.soundPath) : undefined;
						const previousAssignment = existingConfig?.assignments.find((candidate) => candidate.padId === assignment.padId);
						const unchangedLegacy = Boolean(
							previousAssignment &&
							previousAssignment.soundId === assignment.soundId &&
							previousAssignment.soundPath === assignment.soundPath,
						);
						if (registered) {
							if (!registered.available && !unchangedLegacy) return soundPadResponse({ error: "El sonido registrado no está disponible." }, 400);
							if (assignment.soundId !== registered.soundId) return soundPadResponse({ error: "El IDSONG no corresponde a la ruta registrada." }, 400);
							continue;
						}
						if (assignment.soundId && SOUND_BY_ID[assignment.soundId as keyof typeof SOUND_BY_ID] && !assignment.soundPath) continue;
						if (!unchangedLegacy) return soundPadResponse({ error: "El sonido no está registrado en el inventario." }, 400);
					}
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

			if (role === "COHOST" && this.playbackState) {
				connection.send(
					JSON.stringify({
						type: "playback-state",
						...this.playbackState,
					}),
				);
			}
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

			case "playback-state": {
				if (role !== "HOST") {
					return;
				}

				this.playbackState = {
					id: data.id,
					playing: data.playing,
				};

				const payload = JSON.stringify({
					type: "playback-state",
					...this.playbackState,
				});
				for (const target of this.getConnections()) {
					const targetState = target.state as { role?: ClientRole } | null;
					if (targetState?.role === "COHOST") {
						target.send(payload);
					}
				}
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
					if (this.playbackState?.id === data.id) {
						this.playbackState = null;
					}
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
					if (this.playbackState?.id === video.id) {
						this.playbackState = null;
					}

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
	SOUND_INVENTORY_SYNC_SECRET?: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/soundpad") {
			const resource = url.searchParams.get("resource");
			if (resource === "soundInventorySync" || resource === "soundInventoryScan") {
				const secret = env.SOUND_INVENTORY_SYNC_SECRET;
				if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) {
					return soundPadResponse({ error: "Unauthorized inventory update" }, 401);
				}
			}
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
