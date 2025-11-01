import { Request, Response, NextFunction } from 'express';
import Redis from 'redis';

let redisClient: any = null;

try {
  redisClient = Redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  redisClient.connect().catch((error: any) => {
    console.warn('Redis connection failed, caching disabled:', error.message);
    redisClient = null;
  });
} catch (error) {
  console.warn('Redis not available, caching disabled');
  redisClient = null;
}

export const cacheMiddleware = (ttlSeconds: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redisClient) {
      return next();
    }

    const key = `cache:${req.originalUrl}`;

    try {
      const cachedData = await redisClient.get(key);
      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cachedData));
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }

    const originalJson = res.json;
    res.json = function(data) {
      try {
        if (redisClient) {
          redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
        }
      } catch (error) {
        console.error('Cache write error:', error);
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson.call(this, data);
    };

    next();
  };
};

export const invalidateCache = (pattern: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redisClient) {
      return next();
    }

    try {
      const keys = await redisClient.keys(`cache:${pattern}`);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
    next();
  };
};
