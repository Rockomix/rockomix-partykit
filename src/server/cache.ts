import { kv } from "@vercel/kv";

const useVercelKv = process.env.USE_VERCEL_KV === "true";

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    // [LOCAL_DEV]
    if (!useVercelKv) {
      return null;
    }

    // [PRODUCTION]
    try {
      const value = await kv.get<T>(key);
      return value;
    } catch (error) {
      // [PRODUCTION]
      console.error("Vercel KV get failed", { key, error });
      throw error;
    }
  },

  async set<T>(
    key: string,
    value: T,
    expirationInSeconds?: number,
  ): Promise<void> {
    // [LOCAL_DEV]
    // [ROCKOMIX_FUTURE]
    // Este punto podra reemplazarse por:
    // - SQLite local
    // - Redis
    // - Cache hibrida SQLite + YouTube
    // Mantener interfaz cache.get() y cache.set() para compatibilidad.
    if (!useVercelKv) {
      return;
    }

    // [PRODUCTION]
    try {
      await kv.set(key, value);

      if (expirationInSeconds && expirationInSeconds > 0) {
        await kv.expire(key, expirationInSeconds);
      }
    } catch (error) {
      // [PRODUCTION]
      console.error("Vercel KV set failed", { key, error });
      throw error;
    }
  },
};
