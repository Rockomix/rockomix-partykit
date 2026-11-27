import { log } from "next-axiom";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const youtubeRouter = createTRPCRouter({
  search: publicProcedure
    .input(z.object({ keyword: z.string() }))
    .query(async ({ input, ctx }) => {
      const keyword = input.keyword.trim().replace(/\s+/g, " ").toLowerCase();

      log.info("Searching for videos", { keyword });

      const cacheKey = `youtube-search:${keyword}`;

      const cachedVideos =
        await ctx.cache.get<ReturnType<typeof ctx.youtube.searchVideo>>(
          cacheKey,
        );

      if (cachedVideos === null) {
        // cache miss
        log.info("Cache miss, searching YouTube API", {
          keyword,
        });

        const videos = await ctx.youtube.searchVideo(keyword, 24);

        if (videos) {
          log.info("Storing results in cache for", { keyword });
          await ctx.cache.set(cacheKey, videos, 60 * 60 * 24); // 24h cache
        }

        return videos;
      }

      return cachedVideos;
    }),
});
