import { createClient, RedisClientType } from 'redis';
import logger from './logger';
import { cacheConfig } from '../config';

class CacheManager {
    private client: RedisClientType | null = null;
    private memoryCache: Map<string, { value: any; expiresAt: number }> = new Map();
    private isRedisAvailable = false;

    constructor() {
        if (cacheConfig.enabled) {
            this.initializeRedis();
        } else {
            logger.info('Cache using memory storage (Redis disabled)');
        }
    }

    private async initializeRedis(): Promise<void> {
        try {
            this.client = createClient({
                socket: {
                    host: cacheConfig.host,
                    port: cacheConfig.port
                },
                password: cacheConfig.password,
                database: cacheConfig.db
            });

            this.client.on('error', (error) => {
                logger.error('Redis error:', error);
                this.isRedisAvailable = false;
            });

            this.client.on('connect', () => {
                logger.info('Redis connected successfully');
                this.isRedisAvailable = true;
            });

            this.client.on('disconnect', () => {
                logger.warn('Redis disconnected');
                this.isRedisAvailable = false;
            });

            await this.client.connect();
        } catch (error) {
            logger.error('Failed to initialize Redis cache:', error);
            logger.info('Falling back to memory cache');
            this.isRedisAvailable = false;
        }
    }

    private getKey(key: string): string {
        return `${cacheConfig.keyPrefix}${key}`;
    }

    public async get<T = any>(key: string): Promise<T | null> {
        const fullKey = this.getKey(key);

        if (this.isRedisAvailable && this.client) {
            try {
                const value = await this.client.get(fullKey);
                return value ? JSON.parse(value) : null;
            } catch (error) {
                logger.warn('Redis get error, falling back to memory:', error);
                this.isRedisAvailable = false;
            }
        }

        // Memory cache fallback
        const cached = this.memoryCache.get(fullKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        } else if (cached) {
            this.memoryCache.delete(fullKey);
        }
        
        return null;
    }

    public async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
        const fullKey = this.getKey(key);
        const serialized = JSON.stringify(value);

        if (this.isRedisAvailable && this.client) {
            try {
                if (ttlSeconds) {
                    await this.client.setEx(fullKey, ttlSeconds, serialized);
                } else {
                    await this.client.set(fullKey, serialized);
                }
                return;
            } catch (error) {
                logger.warn('Redis set error, falling back to memory:', error);
                this.isRedisAvailable = false;
            }
        }

        // Memory cache fallback
        const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : Number.MAX_SAFE_INTEGER;
        this.memoryCache.set(fullKey, { value, expiresAt });

        // Clean up expired entries periodically
        this.cleanupMemoryCache();
    }

    public async del(key: string): Promise<void> {
        const fullKey = this.getKey(key);

        if (this.isRedisAvailable && this.client) {
            try {
                await this.client.del(fullKey);
                return;
            } catch (error) {
                logger.warn('Redis del error:', error);
            }
        }

        this.memoryCache.delete(fullKey);
    }

    public async exists(key: string): Promise<boolean> {
        const fullKey = this.getKey(key);

        if (this.isRedisAvailable && this.client) {
            try {
                const result = await this.client.exists(fullKey);
                return result === 1;
            } catch (error) {
                logger.warn('Redis exists error:', error);
                this.isRedisAvailable = false;
            }
        }

        const cached = this.memoryCache.get(fullKey);
        return cached !== undefined && cached.expiresAt > Date.now();
    }

    public async clear(pattern?: string): Promise<void> {
        if (this.isRedisAvailable && this.client) {
            try {
                if (pattern) {
                    const keys = await this.client.keys(`${cacheConfig.keyPrefix}${pattern}`);
                    if (keys.length > 0) {
                        await this.client.del(keys);
                    }
                } else {
                    await this.client.flushDb();
                }
                return;
            } catch (error) {
                logger.warn('Redis clear error:', error);
            }
        }

        if (pattern) {
            const prefix = this.getKey(pattern.replace('*', ''));
            const keysToDelete: string[] = [];
            for (const [key] of this.memoryCache) {
                if (key.startsWith(prefix)) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => this.memoryCache.delete(key));
        } else {
            this.memoryCache.clear();
        }
    }

    private cleanupMemoryCache(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];
        
        for (const [key, cached] of this.memoryCache) {
            if (cached.expiresAt <= now) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.memoryCache.delete(key));
    }

    public getStats(): { memoryKeys: number; redisConnected: boolean } {
        return {
            memoryKeys: this.memoryCache.size,
            redisConnected: this.isRedisAvailable
        };
    }

    public async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.disconnect();
        }
    }

    // Helper methods for common cache operations
    public async getCachedPrice(symbol: string, exchange: string): Promise<any> {
        return this.get(`price:${exchange}:${symbol}`);
    }

    public async setCachedPrice(symbol: string, exchange: string, data: any): Promise<void> {
        await this.set(`price:${exchange}:${symbol}`, data, cacheConfig.ttl.prices);
    }

    public async getCachedIndicators(symbol: string, exchange: string, timeframe: string): Promise<any> {
        return this.get(`indicators:${exchange}:${symbol}:${timeframe}`);
    }

    public async setCachedIndicators(symbol: string, exchange: string, timeframe: string, data: any): Promise<void> {
        await this.set(`indicators:${exchange}:${symbol}:${timeframe}`, data, cacheConfig.ttl.indicators);
    }

    public async getCachedArbitrage(symbol: string): Promise<any> {
        return this.get(`arbitrage:${symbol}`);
    }

    public async setCachedArbitrage(symbol: string, data: any): Promise<void> {
        await this.set(`arbitrage:${symbol}`, data, cacheConfig.ttl.arbitrage);
    }

    public async getCachedOHLCV(exchange: string, symbol: string, timeframe: string, limit: number): Promise<any> {
        return this.get(`ohlcv:${exchange}:${symbol}:${timeframe}:${limit}`);
    }

    public async setCachedOHLCV(exchange: string, symbol: string, timeframe: string, limit: number, data: any): Promise<void> {
        await this.set(`ohlcv:${exchange}:${symbol}:${timeframe}:${limit}`, data, 60); // 1 minute TTL for OHLCV
    }
}

// Singleton instance
export const cacheManager = new CacheManager();
export default cacheManager;