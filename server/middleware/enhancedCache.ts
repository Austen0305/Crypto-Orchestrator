import { Request, Response, NextFunction } from 'express';
import { cacheService, CacheKeyBuilder } from '../services/cacheService';
import logger from '../services/logger';

// 增强的缓存中间件选项
interface CacheOptions {
  ttl?: number;              // 自定义TTL（秒）
  keyGenerator?: (req: Request) => string;  // 自定义键生成函数
  condition?: (req: Request) => boolean;    // 缓存条件
  invalidateOn?: string[];  // 当这些路由被调用时，使此缓存失效
  tags?: string[];          // 缓存标签，用于批量失效
}

// 默认的键生成器函数
const defaultKeyGenerator = (req: Request): string => {
  // 从URL路径和查询参数生成键
  const path = req.path;
  const query = new URLSearchParams(req.query as any).toString();
  return `${path}${query ? '?' + query : ''}`;
};

// 缓存中间件
export const enhancedCacheMiddleware = (options: CacheOptions = {}) => {
  const {
    ttl,
    keyGenerator = defaultKeyGenerator,
    condition = () => true,
    invalidateOn = [],
    tags = []
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // 检查是否应该缓存此请求
    if (!condition(req) || req.method !== 'GET') {
      return next();
    }

    try {
      // 生成缓存键
      const key = CacheKeyBuilder.marketData('default', 'default') + keyGenerator(req);

      // 尝试从缓存获取响应
      const cachedResponse = await cacheService.get(key);

      if (cachedResponse) {
        // 设置缓存头
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Tags', tags.join(','));

        // 返回缓存的响应
        return res.json(cachedResponse);
      }

      // 拦截res.json方法以缓存响应
      const originalJson = res.json;
      res.json = function(data: any) {
        // 缓存响应
        cacheService.set(key, data, ttl);

        // 设置缓存头
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Tags', tags.join(','));

        // 调用原始方法
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('缓存中间件错误', {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
        method: req.method
      });
      next();
    }
  };
};

// 缓存失效中间件
export const invalidateCacheMiddleware = (patterns: string[], tags: string[] = []) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function(data: any) {
      // 在响应发送后执行缓存失效
      setTimeout(async () => {
        try {
          // 使匹配模式的缓存失效
          for (const pattern of patterns) {
            // 这里可以实现更复杂的模式匹配逻辑
            // 简单实现：删除包含模式字符串的所有键
            const keys = await getCacheKeysByPattern(pattern);
            for (const key of keys) {
              await cacheService.del(key);
            }
          }

          // 使带有特定标签的缓存失效
          if (tags.length > 0) {
            // 这里可以实现基于标签的缓存失效
            // 简单实现：维护一个标签到键的映射
            for (const tag of tags) {
              const keys = await getCacheKeysByTag(tag);
              for (const key of keys) {
                await cacheService.del(key);
              }
            }
          }

          logger.info('缓存已失效', {
            patterns,
            tags,
            path: req.path,
            method: req.method
          });
        } catch (error) {
          logger.error('缓存失效失败', {
            error: error instanceof Error ? error.message : String(error),
            patterns,
            tags
          });
        }
      }, 0);

      return originalJson.call(this, data);
    };

    next();
  };
};

// 预定义的缓存中间件
export const marketDataCache = (ttl?: number) => enhancedCacheMiddleware({
  ttl: ttl || 60,  // 默认1分钟
  tags: ['market-data']
});

export const tradingPairsCache = (ttl?: number) => enhancedCacheMiddleware({
  ttl: ttl || 600,  // 默认10分钟
  tags: ['trading-pairs']
});

export const userInfoCache = (ttl?: number) => enhancedCacheMiddleware({
  ttl: ttl || 1800,  // 默认30分钟
  tags: ['user-info'],
  condition: (req) => !!req.user  // 只缓存已认证用户的请求
});

export const botStatusCache = (ttl?: number) => enhancedCacheMiddleware({
  ttl: ttl || 120,  // 默认2分钟
  tags: ['bot-status'],
  condition: (req) => !!req.user  // 只缓存已认证用户的请求
});

export const portfolioCache = (ttl?: number) => enhancedCacheMiddleware({
  ttl: ttl || 300,  // 默认5分钟
  tags: ['portfolio'],
  condition: (req) => !!req.user,  // 只缓存已认证用户的请求
  invalidateOn: ['/api/trades']  // 当有新交易时失效
});

// 辅助函数：根据模式获取缓存键
async function getCacheKeysByPattern(pattern: string): Promise<string[]> {
  // 这里可以实现更复杂的模式匹配逻辑
  // 简单实现：返回所有键，让调用者过滤
  // 在实际应用中，Redis支持KEYS命令，但应谨慎使用
  try {
    const stats = await cacheService.getStats();
    if (stats.redis && stats.redis.connected) {
      // 如果使用Redis，可以使用KEYS命令
      // 但在生产环境中应避免使用KEYS，改用SCAN
      // 这里简化实现
      return [];
    } else {
      // 如果使用内存缓存，可以遍历所有键
      // 这里简化实现
      return [];
    }
  } catch (error) {
    logger.error('获取缓存键失败', {
      error: error instanceof Error ? error.message : String(error),
      pattern
    });
    return [];
  }
}

// 辅助函数：根据标签获取缓存键
async function getCacheKeysByTag(tag: string): Promise<string[]> {
  // 这里可以实现基于标签的缓存键查找
  // 简化实现
  try {
    // 在实际应用中，可以维护一个标签到键的映射
    // 这里简化实现
    return [];
  } catch (error) {
    logger.error('根据标签获取缓存键失败', {
      error: error instanceof Error ? error.message : String(error),
      tag
    });
    return [];
  }
}
