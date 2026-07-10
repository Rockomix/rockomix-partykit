import { kv } from "@vercel/kv";

export const cache = {
  async get<T>(key: string) {
    const value = await kv.get<T>(key);

    return value;
  },

  async set<T>(key: string, value: T, expirationInSeconds?: number) {
    await kv.set(key, value);

    if (expirationInSeconds && expirationInSeconds > 0) {
      await kv.expire(key, expirationInSeconds);
    }
  },
};
