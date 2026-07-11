import { Cache } from 'cache-manager';
export declare function withCache<T>(cacheManager: Cache, key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>;
