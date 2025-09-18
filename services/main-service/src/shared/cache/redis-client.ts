/**
 * Redis Client for Caching and Session Management
 * 
 * Provides Redis functionality with proper error handling,
 * connection management, and performance optimizations
 */

import Redis from 'ioredis';
import { config } from '../../config';
import { Logger } from '../utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean; // Whether to compress large values
}

export class RedisClient {
  private static instance: RedisClient;
  private redis: Redis | null = null;
  private sessionRedis: Redis | null = null;
  private logger: Logger;
  private isConnected: boolean = false;

  private constructor() {
    this.logger = new Logger('RedisClient');
    
    // Only initialize if Redis caching is enabled
    if (config.features.enableRedisCache) {
      this.logger.info('Redis cache is enabled, initializing connections');
      this.initializeConnections();
    } else {
      this.logger.info('Redis cache is disabled, skipping connection initialization');
    }
  }

  static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  private initializeConnections(): void {
    // Only initialize if caching is enabled
    if (!config.features.enableRedisCache) {
      this.logger.debug('Redis cache disabled, skipping connection initialization');
      return;
    }

    // Main cache Redis connection
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.cacheDb,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
    });

    // Session management Redis connection
    this.sessionRedis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.sessionDb,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.redis || !this.sessionRedis) {
      return;
    }

    // Cache Redis events
    this.redis.on('connect', () => {
      this.logger.info('Redis cache connection established');
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      this.logger.info('Redis cache ready for operations');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis cache error', { error: error.message });
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Redis cache connection closed');
    });

    // Session Redis events
    this.sessionRedis.on('connect', () => {
      this.logger.info('Redis session connection established');
    });

    this.sessionRedis.on('error', (error) => {
      this.logger.error('Redis session error', { error: error.message });
    });
  }

  /**
   * Connect to Redis (lazy connection)
   */
  async connect(): Promise<void> {
    if (!config.features.enableRedisCache) {
      this.logger.debug('Redis cache disabled, skipping connection');
      return;
    }

    if (this.isConnected) return;

    try {
      if (this.redis && this.sessionRedis) {
        await Promise.all([
          this.redis.connect(),
          this.sessionRedis.connect(),
        ]);

        this.logger.info('Redis clients connected successfully');
      }
    } catch (error: any) {
      this.logger.error('Failed to connect to Redis', { error: error.message });
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.redis && this.sessionRedis) {
        await Promise.all([
          this.redis.quit(),
          this.sessionRedis.quit(),
        ]);
      }

      this.isConnected = false;
      this.logger.info('Redis clients disconnected');
    } catch (error: any) {
      this.logger.error('Error disconnecting from Redis', { error: error.message });
    }
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    if (!config.features.enableRedisCache) return;

    try {
      await this.ensureConnected();
      
      if (!this.redis) {
        return; // Redis not available, fail silently for cache operations
      }
      
      let serializedValue = JSON.stringify(value);
      
      // Compress large values if requested
      if (options.compress && serializedValue.length > 1024) {
        // Simple compression flag - in production you'd use actual compression
        serializedValue = `[COMPRESSED]${serializedValue}`;
      }

      const ttl = options.ttl || 300; // 5 minutes default
      await this.redis.setex(key, ttl, serializedValue);

      this.logger.debug('Cache set', { 
        key, 
        size: serializedValue.length, 
        ttl,
        compressed: options.compress 
      });
    } catch (error: any) {
      this.logger.error('Failed to set cache', { error: error.message, key });
      // Don't throw - caching should be non-blocking
    }
  }

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!config.features.enableRedisCache) return null;

    try {
      await this.ensureConnected();
      
      const value = await this.redis.get(key);
      if (!value) return null;

      // Handle compressed values
      let actualValue = value;
      if (value.startsWith('[COMPRESSED]')) {
        actualValue = value.substring(12); // Remove compression flag
      }

      const result = JSON.parse(actualValue);
      
      this.logger.debug('Cache hit', { key, size: value.length });
      return result;
    } catch (error: any) {
      this.logger.error('Failed to get cache', { error: error.message, key });
      return null; // Cache misses should not break the application
    }
  }

  /**
   * Delete a value from cache
   */
  async del(key: string): Promise<void> {
    if (!config.features.enableRedisCache) return;

    try {
      await this.ensureConnected();
      await this.redis.del(key);
      
      this.logger.debug('Cache deleted', { key });
    } catch (error: any) {
      this.logger.error('Failed to delete cache', { error: error.message, key });
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!config.features.enableRedisCache) return false;

    try {
      await this.ensureConnected();
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error: any) {
      this.logger.error('Failed to check cache existence', { error: error.message, key });
      return false;
    }
  }

  /**
   * Set TTL for existing key
   */
  async expire(key: string, ttl: number): Promise<void> {
    if (!config.features.enableRedisCache) return;

    try {
      await this.ensureConnected();
      await this.redis.expire(key, ttl);
      
      this.logger.debug('Cache TTL updated', { key, ttl });
    } catch (error: any) {
      this.logger.error('Failed to set cache TTL', { error: error.message, key });
    }
  }

  /**
   * Clear all cache by pattern
   */
  async clearPattern(pattern: string): Promise<void> {
    if (!config.features.enableRedisCache) return;

    try {
      await this.ensureConnected();
      
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.info('Cache pattern cleared', { pattern, keysCleared: keys.length });
      }
    } catch (error: any) {
      this.logger.error('Failed to clear cache pattern', { error: error.message, pattern });
    }
  }

  /**
   * Increment a counter in cache
   */
  async incr(key: string, ttl = 3600): Promise<number> {
    if (!config.features.enableRedisCache) return 1;

    try {
      await this.ensureConnected();
      
      const value = await this.redis.incr(key);
      
      // Set TTL on first increment
      if (value === 1) {
        await this.redis.expire(key, ttl);
      }
      
      return value;
    } catch (error: any) {
      this.logger.error('Failed to increment cache', { error: error.message, key });
      return 1;
    }
  }

  // ================================
  // Session Management
  // ================================

  /**
   * Set session data
   */
  async setSession(sessionId: string, data: any, ttl = 86400): Promise<void> {
    if (!config.features.enableRedisCache) return;
    
    try {
      await this.ensureConnected();
      
      if (!this.sessionRedis) return;
      
      const sessionKey = `session:${sessionId}`;
      const serializedData = JSON.stringify(data);
      
      await this.sessionRedis.setex(sessionKey, ttl, serializedData);
      
      this.logger.debug('Session set', { sessionId, ttl });
    } catch (error: any) {
      this.logger.error('Failed to set session', { error: error.message, sessionId });
    }
  }

  /**
   * Get session data
   */
  async getSession<T = any>(sessionId: string): Promise<T | null> {
    if (!config.features.enableRedisCache) return null;
    
    try {
      await this.ensureConnected();
      
      if (!this.sessionRedis) return null;
      
      const sessionKey = `session:${sessionId}`;
      const data = await this.sessionRedis.get(sessionKey);
      
      if (!data) return null;
      
      return JSON.parse(data);
    } catch (error: any) {
      this.logger.error('Failed to get session', { error: error.message, sessionId });
      return null;
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!config.features.enableRedisCache) return;
    
    try {
      await this.ensureConnected();
      
      if (!this.sessionRedis) return;
      
      const sessionKey = `session:${sessionId}`;
      await this.sessionRedis.del(sessionKey);
      
      this.logger.debug('Session deleted', { sessionId });
    } catch (error: any) {
      this.logger.error('Failed to delete session', { error: error.message, sessionId });
    }
  }

  // ================================
  // Utility Methods
  // ================================

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      if (!config.features.enableRedisCache || !this.redis) {
        const latency = Date.now() - startTime;
        return { 
          status: 'healthy', 
          latency,
          error: 'Redis cache disabled' 
        };
      }

      await this.ensureConnected();
      await this.redis.ping();
      
      const latency = Date.now() - startTime;
      
      return { status: 'healthy', latency };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      return { 
        status: 'unhealthy', 
        latency, 
        error: error.message 
      };
    }
  }

  /**
   * Get Redis info
   */
  async getInfo(): Promise<any> {
    try {
      if (!config.features.enableRedisCache || !this.redis) {
        return null;
      }
      
      await this.ensureConnected();
      const info = await this.redis.info();
      return this.parseRedisInfo(info);
    } catch (error: any) {
      this.logger.error('Failed to get Redis info', { error: error.message });
      return null;
    }
  }

  /**
   * Generate cache key with namespace
   */
  static generateKey(namespace: string, ...parts: string[]): string {
    return `fluxion:${namespace}:${parts.join(':')}`;
  }

  /**
   * Ensure Redis connection is established
   */
  private async ensureConnected(): Promise<void> {
    if (!config.features.enableRedisCache) {
      return;
    }
    
    if (!this.isConnected) {
      await this.connect();
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): any {
    const result: any = {};
    const sections = info.split('\r\n\r\n');
    
    sections.forEach(section => {
      const lines = section.split('\r\n');
      const sectionName = lines[0].replace('# ', '');
      result[sectionName] = {};
      
      lines.slice(1).forEach(line => {
        if (line && line.includes(':')) {
          const [key, value] = line.split(':');
          result[sectionName][key] = isNaN(Number(value)) ? value : Number(value);
        }
      });
    });
    
    return result;
  }
}

// Export function to get singleton instance (lazy initialization)
export const getRedisClient = (): RedisClient => RedisClient.getInstance();

// Helper functions for common cache patterns
export const CacheHelper = {
  /**
   * Cache with fallback pattern
   */
  async getOrSet<T>(
    key: string,
    fallbackFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await getRedisClient().get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fallbackFn();
    await getRedisClient().set(key, result, options);
    return result;
  },

  /**
   * Generate tenant-specific cache key
   */
  tenantKey(tenantId: string, resource: string, id?: string): string {
    const parts = ['tenant', tenantId, resource];
    if (id) parts.push(id);
    return RedisClient.generateKey('data', ...parts);
  },

  /**
   * Generate user-specific cache key
   */
  userKey(tenantId: string, userId: string, resource: string): string {
    return RedisClient.generateKey('user', tenantId, userId, resource);
  },

  /**
   * Clear tenant cache
   */
  async clearTenantCache(tenantId: string): Promise<void> {
    const pattern = RedisClient.generateKey('data', 'tenant', tenantId, '*');
    await getRedisClient().clearPattern(pattern);
  },

  /**
   * Clear user cache
   */
  async clearUserCache(tenantId: string, userId: string): Promise<void> {
    const pattern = RedisClient.generateKey('user', tenantId, userId, '*');
    await getRedisClient().clearPattern(pattern);
  },
};

// For backwards compatibility, export the getter function as default
export default getRedisClient;