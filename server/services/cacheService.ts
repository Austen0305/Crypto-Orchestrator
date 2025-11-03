import Redis from 'ioredis';
import logger from './logger';

// 缓存配置
const CACHE_CONFIG = {
  // 默认过期时间（秒）
  defaultTTL: 300, // 5分钟

  // 特定类型的缓存过期时间
  marketData: 60,     // 1分钟
  orderBook: 30,      // 30秒
  tradingPairs: 600,  // 10分钟
  userInfo: 1800,     // 30分钟
  botStatus: 120,     // 2分钟
  portfolio: 300,     // 5分钟
  apiKeys: 3600,      // 1小时

  // 最大缓存条目数
  maxEntries: 10000,

  // 键前缀
  keyPrefix: 'co:', // CryptoOrchestrator
};

// 缓存键生成器
export class CacheKeyBuilder {
  static marketData(pair: string, timeframe: string): string {
    return `${CACHE_CONFIG.keyPrefix}market:${pair}:${timeframe}`;
  }

  static orderBook(pair: string): string {
    return `${CACHE_CONFIG.keyPrefix}orderbook:${pair}`;
  }

  static tradingPairs(): string {
    return `${CACHE_CONFIG.keyPrefix}trading_pairs`;
  }

  static userInfo(userId: string): string {
    return `${CACHE_CONFIG.keyPrefix}user:${userId}`;
  }

  static botStatus(botId: string): string {
    return `${CACHE_CONFIG.keyPrefix}bot:${botId}:status`;
  }

  static portfolio(mode: string, userId?: string): string {
    const userPart = userId ? `:${userId}` : '';
    return `${CACHE_CONFIG.keyPrefix}portfolio:${mode}${userPart}`;
  }

  static apiKeys(userId: string): string {
    return `${CACHE_CONFIG.keyPrefix}api_keys:${userId}`;
  }

  static mlModelState(botId: string): string {
    return `${CACHE_CONFIG.keyPrefix}ml_model:${botId}`;
  }

  static backtestResults(botId: string): string {
    return `${CACHE_CONFIG.keyPrefix}backtest:${botId}`;
  }
}

// 内存缓存实现（作为Redis的后备）
class MemoryCache {
  private cache: Map<string, { value: any; expiresAt: number }>;
  private maxSize: number;

  constructor(maxSize: number = CACHE_CONFIG.maxEntries) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  set(key: string, value: any, ttl: number = CACHE_CONFIG.defaultTTL): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const expiresAt = Date.now() + (ttl * 1000);
    this.cache.set(key, { value, expiresAt });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  del(key: string): void {
    this.cache.delete(key);
  }

  exists(key: string): boolean {
    const item = this.cache.get(key);
    return item !== null && Date.now() <= item.expiresAt;
  }

  clear(): void {
    this.cache.clear();
  }

  // 清理过期条目
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// 缓存服务类
export class CacheService {
  private redis: Redis | null = null;
  private memoryCache: MemoryCache;
  private isRedisAvailable: boolean = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.memoryCache = new MemoryCache();

    // 尝试连接Redis
    this.connectToRedis();

    // 设置定期清理内存缓存
    this.cleanupInterval = setInterval(() => {
      this.memoryCache.cleanup();
    }, 60000); // 每分钟清理一次
  }

  private async connectToRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL;

      if (!redisUrl) {
        logger.info('未配置Redis URL，使用内存缓存');
        return;
      }

      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        logger.info('Redis连接成功');
        this.isRedisAvailable = true;
      });

      this.redis.on('error', (error) => {
        logger.error('Redis连接错误', { error: error.message });
        this.isRedisAvailable = false;
      });

      this.redis.on('close', () => {
        logger.warn('Redis连接关闭');
        this.isRedisAvailable = false;
      });

      await this.redis.connect();
    } catch (error) {
      logger.error('初始化Redis失败，使用内存缓存', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.isRedisAvailable = false;
    }
  }

  // 设置缓存
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const effectiveTTL = ttl || this.getTTLForKey(key);

    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.setex(key, effectiveTTL, JSON.stringify(value));
      } catch (error) {
        logger.error('Redis设置缓存失败，回退到内存缓存', {
          error: error instanceof Error ? error.message : String(error),
          key
        });
        this.memoryCache.set(key, value, effectiveTTL);
      }
    } else {
      this.memoryCache.set(key, value, effectiveTTL);
    }
  }

  // 获取缓存
  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const value = await this.redis.get(key);
        if (value) {
          return JSON.parse(value);
        }
      } catch (error) {
        logger.error('Redis获取缓存失败，回退到内存缓存', {
          error: error instanceof Error ? error.message : String(error),
          key
        });
        return this.memoryCache.get(key);
      }
    }

    return this.memoryCache.get(key);
  }

  // 删除缓存
  async del(key: string): Promise<void> {
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        logger.error('Redis删除缓存失败，回退到内存缓存', {
          error: error instanceof Error ? error.message : String(error),
          key
        });
        this.memoryCache.del(key);
      }
    } else {
      this.memoryCache.del(key);
    }
  }

  // 检查键是否存在
  async exists(key: string): Promise<boolean> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const result = await this.redis.exists(key);
        return result === 1;
      } catch (error) {
        logger.error('Redis检查缓存存在性失败，回退到内存缓存', {
          error: error instanceof Error ? error.message : String(error),
          key
        });
        return this.memoryCache.exists(key);
      }
    }

    return this.memoryCache.exists(key);
  }

  // 清空所有缓存
  async clear(): Promise<void> {
    if (this.isRedisAvailable && this.redis) {
      try {
        // 只删除带有我们前缀的键
        const keys = await this.redis.keys(`${CACHE_CONFIG.keyPrefix}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        logger.error('Redis清空缓存失败，回退到内存缓存', {
          error: error instanceof Error ? error.message : String(error)
        });
        this.memoryCache.clear();
      }
    } else {
      this.memoryCache.clear();
    }
  }

  // 根据键获取TTL
  private getTTLForKey(key: string): number {
    if (key.includes('market:')) {
      return CACHE_CONFIG.marketData;
    } else if (key.includes('orderbook:')) {
      return CACHE_CONFIG.orderBook;
    } else if (key.includes('trading_pairs')) {
      return CACHE_CONFIG.tradingPairs;
    } else if (key.includes('user:')) {
      return CACHE_CONFIG.userInfo;
    } else if (key.includes('bot:') && key.includes(':status')) {
      return CACHE_CONFIG.botStatus;
    } else if (key.includes('portfolio:')) {
      return CACHE_CONFIG.portfolio;
    } else if (key.includes('api_keys:')) {
      return CACHE_CONFIG.apiKeys;
    } else {
      return CACHE_CONFIG.defaultTTL;
    }
  }

  // 获取缓存统计信息
  async getStats(): Promise<any> {
    const memoryStats = {
      size: this.memoryCache['cache'].size,
      maxSize: this.memoryCache['maxSize']
    };

    let redisStats = null;
    if (this.isRedisAvailable && this.redis) {
      try {
        const info = await this.redis.info('memory');
        redisStats = {
          connected: true,
          memory: info
        };
      } catch (error) {
        redisStats = {
          connected: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    } else {
      redisStats = { connected: false };
    }

    return {
      memory: memoryStats,
      redis: redisStats,
      isRedisAvailable: this.isRedisAvailable
    };
  }

  // 关闭缓存服务
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// 导出单例实例
export const cacheService = new CacheService();
