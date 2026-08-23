/**
 * High-performance In-Memory API Cache
 * Built with Map for O(1) lookups, TTL expiration, tag-based invalidation,
 * and LRU memory bounding to avoid memory leaks.
 */

export interface CacheEntry<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
  createdAt: number;
  expiresAt: number;
  lastAccessed: number;
  tags: string[];
}

export interface CacheOptions {
  ttlMs?: number; // Time-to-live in milliseconds (default: 60,000ms = 60s)
  tags?: string[]; // Tags for selective invalidation
  status?: number;
  headers?: Record<string, string>;
}

export interface ApiMemoryCacheConfig {
  defaultTtlMs?: number;
  maxEntries?: number;
  cleanupIntervalMs?: number;
}

export class ApiMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private defaultTtlMs: number;
  private maxEntries: number;
  private hits = 0;
  private misses = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: ApiMemoryCacheConfig) {
    this.defaultTtlMs = config?.defaultTtlMs ?? 60 * 1000; // 60s default
    this.maxEntries = config?.maxEntries ?? 1000; // 1,000 max cached responses

    const cleanupInterval = config?.cleanupIntervalMs ?? 120 * 1000; // Sweep every 2 mins
    if (typeof setInterval !== "undefined") {
      this.cleanupTimer = setInterval(() => this.purgeExpired(), cleanupInterval);
      if (this.cleanupTimer && typeof this.cleanupTimer.unref === "function") {
        this.cleanupTimer.unref(); // Don't prevent process from exiting
      }
    }
  }

  /**
   * Retrieve cached item if exists and not expired
   */
  get<T = unknown>(key: string): CacheEntry<T> | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    entry.lastAccessed = now;
    this.hits++;
    return entry as CacheEntry<T>;
  }

  /**
   * Store item with TTL and optional tags
   */
  set<T = unknown>(key: string, data: T, options?: CacheOptions): void {
    const now = Date.now();
    const ttlMs = options?.ttlMs ?? this.defaultTtlMs;

    // Guard memory: If capacity exceeded, evict least recently used entries
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      this.evictLru(Math.max(1, Math.floor(this.maxEntries * 0.1))); // Evict 10%
    }

    this.store.set(key, {
      data,
      status: options?.status ?? 200,
      headers: options?.headers ?? {},
      createdAt: now,
      expiresAt: now + ttlMs,
      lastAccessed: now,
      tags: options?.tags || [],
    });
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Invalidate by prefix or regex
   */
  invalidate(patternOrPrefix: string | RegExp): number {
    let deletedCount = 0;
    const isRegex = patternOrPrefix instanceof RegExp;

    for (const key of this.store.keys()) {
      const match = isRegex
        ? (patternOrPrefix as RegExp).test(key)
        : key.startsWith(patternOrPrefix as string);

      if (match) {
        this.store.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Invalidate all entries associated with a specific tag
   */
  invalidateByTag(tag: string): number {
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.tags.includes(tag)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Purge expired items
   */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        purged++;
      }
    }
    return purged;
  }

  /**
   * Evict LRU entries to maintain memory ceiling
   */
  private evictLru(count: number): void {
    const entries = Array.from(this.store.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const toDelete = entries.slice(0, count);
    for (const [key] of toDelete) {
      this.store.delete(key);
    }
  }

  /**
   * Get cache diagnostics
   */
  getStats() {
    const totalRequests = this.hits + this.misses;
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? (this.hits / totalRequests) : 0,
    };
  }

  /**
   * Cleanup timer on shutdown
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
  }
}

// Global Singleton instance for application API caching
export const apiCache = new ApiMemoryCache({
  defaultTtlMs: 60 * 1000, // 60 seconds
  maxEntries: 1000,
});

/**
 * Invalidate cache helper by prefix or regex
 */
export function invalidateApiCache(prefixOrRegex: string | RegExp): number {
  return apiCache.invalidate(prefixOrRegex);
}

/**
 * Invalidate cache helper by tag
 */
export function invalidateCacheByTag(tag: string): number {
  return apiCache.invalidateByTag(tag);
}

/**
 * Clear all cached responses
 */
export function clearApiCache(): void {
  apiCache.clear();
}
