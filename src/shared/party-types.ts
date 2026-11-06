export type VideoInPlaylist = {
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

export type KaraokeParty = {
  playlist: VideoInPlaylist[];
  settings: {
    orderByFairness: boolean;
  };
};

export type SoundPadAssignment = {
  padId: number;
  soundId: string | null;
  soundPath?: string | null;
  volume: number;
};

export type SoundInventoryItem = {
  key: string;
  path: string;
  name: string;
  folder: string;
  origin: "catalog" | "file";
  soundId: string | null;
};

export type SoundPadConfig = {
  version: 1;
  assignments: SoundPadAssignment[];
};

export type Message =
  | {
      type: "add-video";
      id: string;
      title: string;
      artist?: string;
      song?: string;
      coverUrl: string;
      duration?: string;
      singerName: string;
    }
  | {
      type: "remove-video";
      id: string;
    }
  | {
      type: "mark-as-played";
      id: string;
    }
  | { type: "horn"; soundId?: string }
  | { type: "soundpad"; soundId: string }
  | { type: "play" }
  | { type: "pause" }
  | {
      type: "reset-song";
      id: string;
    }
  | { type: "toggle-fullscreen" }
  | {
      type: "rating-request";
      songId?: string;
      requestId: string;
    }
  | {
      type: "move-video";
      requestId: string;
      id: string;
      toIndex: number;
    }
  | {
      type: "set-fair-queue";
      requestId: string;
      enabled: boolean;
    };

export type PlaylistOperationResult = {
  type: "playlist-operation-result";
  requestId: string;
  operation: "move-video" | "set-fair-queue";
  accepted: boolean;
  reason?:
    | "unauthorized"
    | "invalid-payload"
    | "video-not-found"
    | "video-already-played"
    | "current-video-protected"
    | "invalid-position"
    | "no-change"
    | "server-error";
};
