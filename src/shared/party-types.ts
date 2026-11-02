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
  | { type: "horn" }
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
    };
