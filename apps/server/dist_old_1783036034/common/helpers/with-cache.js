"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withCache = withCache;
async function withCache(cacheManager, key, ttlMs, fn) {
    try {
        const cached = await cacheManager.get(key);
        if (cached !== undefined && cached !== null) {
            return cached.v;
        }
    }
    catch (err) {
        console.warn(`[withCache] get failed for "${key}", falling back to source`, err);
    }
    const value = await fn();
    try {
        await cacheManager.set(key, { v: value }, ttlMs);
    }
    catch (err) {
        console.warn(`[withCache] set failed for "${key}"`, err);
    }
    return value;
}
//# sourceMappingURL=with-cache.js.map