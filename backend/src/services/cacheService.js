/**
 * Simple in-memory cache service
 * In production, consider using Redis for distributed caching
 */
class CacheService {
    constructor() {
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
        };
    }

    /**
     * Set a value in cache with TTL
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to leave in milliseconds
     */
    set(key, value, ttl) {
        const expiresAt = Date.now() + ttl;
        this.cache.set(key, {
            value,
            expiresAt,
        });
        this.stats.sets++;
    }

    /**
     * Get a value from cache
     * @param {string} key - Cache key
     * @returns {any|null} - Cached value or null if expired/not found
     */
    get(key) {
        const item = this.cache.get(key);

        if (!item) {
            this.stats.misses++;
            return null;
        }

        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return item.value;
    }

    /**
     * Delete a key from cache
     * @param {string} key - Cache key
     */
    delete(key) {
        const result = this.cache.delete(key);
        if (result) {
            this.stats.deletes++;
        }
        return result;
    }

    /**
     * Clear all cache entries
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.stats.deletes += size;
    }

    /**
     * Get cache statistics
     * @returns {object} - Cache stats
     */
    getStats() {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;

        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                expiredEntries++;
            } else {
                validEntries++;
            }
        }

        return {
            totalEntries: this.cache.size,
            validEntries,
            expiredEntries,
            ...this.stats,
            hitRate:
                this.stats.hits + this.stats.misses > 0
                    ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2) +
                      "%"
                    : "0%",
        };
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                this.cache.delete(key);
            }
        }
    }
}

module.exports = new CacheService();
