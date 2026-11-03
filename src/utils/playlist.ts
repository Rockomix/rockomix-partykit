type QueueItem = {
  id: string;
  playedAt: Date | null;
};

export function getQueueIndexes(playlist: QueueItem[]): number[] {
  const indexes: number[] = [];

  playlist.forEach((video, index) => {
    if (!video.playedAt) indexes.push(index);
  });

  return indexes;
}

/**
 * Moves a pending video within the queue of unplayed videos.
 * Queue index 0 is the current queue head and is protected.
 */
export function moveInQueue<T extends QueueItem>(
  playlist: T[],
  videoId: string,
  toIndex: number,
): T[] {
  const queueIndexes = getQueueIndexes(playlist);
  const from = queueIndexes.findIndex(
    (index) => playlist[index]?.id === videoId,
  );
  const to = Math.min(Math.max(toIndex, 1), queueIndexes.length - 1);

  if (from < 1 || to < 1 || from === to) return playlist;

  const queue = queueIndexes.map((index) => playlist[index]!);
  const [moved] = queue.splice(from, 1);
  queue.splice(to, 0, moved!);

  const reordered = [...playlist];
  queueIndexes.forEach((index, queueIndex) => {
    reordered[index] = queue[queueIndex]!;
  });

  return reordered;
}
