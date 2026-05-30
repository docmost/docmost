import { Cache } from 'cache-manager';

export async function withCache<T>(
  cacheManager: Cache,
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const cached = await cacheManager.get<{ v: T }>(key);
    if (cached !== undefined && cached !== null) {
      return cached.v;
    }
  } catch (err) {
    console.warn(`[withCache] get failed for "${key}", falling back to source`, err);
  }

  const value = await fn();

  try {
    await cacheManager.set(key, { v: value }, ttlMs);
  } catch (err) {
    console.warn(`[withCache] set failed for "${key}"`, err);
  }

  return value;
}
