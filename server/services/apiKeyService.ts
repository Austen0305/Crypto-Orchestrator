import { randomBytes } from 'crypto';
import { storage } from '../storage';
import { ApiKey, InsertApiKey, UserRole } from '@shared/schema';
import logger from './logger';
import { AuthenticatedRequest } from '../middleware/enhancedAuth';

export class ApiKeyService {
  // 生成新的API密钥
  static generateApiKey(): string {
    const prefix = 'ck_'; // CryptoOrchestrator Key prefix
    const keyBytes = randomBytes(32);
    const apiKey = prefix + keyBytes.toString('hex');
    return apiKey;
  }

  // 创建新的API密钥
  static async createApiKey(
    userId: string, 
    name: string, 
    permissions: string[], 
    expiresInDays?: number
  ): Promise<ApiKey> {
    try {
      const apiKey = this.generateApiKey();
      const now = Date.now();
      const expiresAt = expiresInDays ? now + (expiresInDays * 24 * 60 * 60 * 1000) : undefined;

      const newApiKey: InsertApiKey = {
        userId,
        key: apiKey,
        name,
        permissions,
        expiresAt,
        isActive: true
      };

      const createdKey = await storage.createApiKey(newApiKey);

      logger.info('API密钥创建成功', {
        apiKeyId: createdKey.id,
        userId,
        name,
        permissions: permissions.join(','),
        expiresAt
      });

      return createdKey;
    } catch (error) {
      logger.error('创建API密钥失败', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        name
      });
      throw error;
    }
  }

  // 验证API密钥
  static async validateApiKey(key: string): Promise<{ valid: boolean; user?: any; permissions?: string[] }> {
    try {
      const apiKeyData = await storage.getApiKeyByKey(key);

      if (!apiKeyData) {
        return { valid: false };
      }

      // 检查密钥是否激活
      if (!apiKeyData.isActive) {
        logger.warn('尝试使用已禁用的API密钥', {
          apiKeyId: apiKeyData.id,
          userId: apiKeyData.userId
        });
        return { valid: false };
      }

      // 检查密钥是否过期
      if (apiKeyData.expiresAt && apiKeyData.expiresAt < Date.now()) {
        logger.warn('尝试使用已过期的API密钥', {
          apiKeyId: apiKeyData.id,
          userId: apiKeyData.userId,
          expiresAt: apiKeyData.expiresAt
        });
        return { valid: false };
      }

      // 获取用户信息
      const user = await storage.getUserById(apiKeyData.userId);
      if (!user || !user.isActive) {
        return { valid: false };
      }

      // 更新最后使用时间
      await storage.updateApiKey(apiKeyData.id, { lastUsed: Date.now() });

      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        permissions: apiKeyData.permissions
      };
    } catch (error) {
      logger.error('验证API密钥时出错', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { valid: false };
    }
  }

  // 撤销API密钥
  static async revokeApiKey(userId: string, apiKeyId: string, userRole?: UserRole): Promise<boolean> {
    try {
      const apiKey = await storage.getApiKeyById(apiKeyId);

      if (!apiKey) {
        return false;
      }

      // 检查用户权限
      if (apiKey.userId !== userId && userRole !== UserRole.ADMIN) {
        logger.warn('尝试撤销不属于自己的API密钥', {
          apiKeyId,
          userId,
          keyOwnerId: apiKey.userId,
          userRole
        });
        return false;
      }

      await storage.updateApiKey(apiKeyId, { isActive: false });

      logger.info('API密钥已撤销', {
        apiKeyId,
        userId,
        revokedBy: userId
      });

      return true;
    } catch (error) {
      logger.error('撤销API密钥失败', {
        error: error instanceof Error ? error.message : String(error),
        apiKeyId,
        userId
      });
      return false;
    }
  }

  // 列出用户的API密钥
  static async listApiKeys(userId: string, userRole?: UserRole): Promise<ApiKey[]> {
    try {
      if (userRole === UserRole.ADMIN) {
        // 管理员可以查看所有API密钥
        const allApiKeys = Array.from((await Promise.all(
          (await storage.getUsers()).map(async (user) => {
            return storage.getApiKeysByUserId(user.id);
          })
        )).flat());

        return allApiKeys;
      } else {
        // 普通用户只能查看自己的API密钥
        return await storage.getApiKeysByUserId(userId);
      }
    } catch (error) {
      logger.error('获取API密钥列表失败', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return [];
    }
  }

  // 获取API密钥使用统计
  static async getApiKeyUsageStats(userId: string, apiKeyId: string, userRole?: UserRole): Promise<any> {
    try {
      const apiKey = await storage.getApiKeyById(apiKeyId);

      if (!apiKey) {
        return null;
      }

      // 检查用户权限
      if (apiKey.userId !== userId && userRole !== UserRole.ADMIN) {
        return null;
      }

      // 这里可以扩展为从日志或数据库中获取实际使用统计
      // 目前返回基本信息
      return {
        id: apiKey.id,
        name: apiKey.name,
        createdAt: apiKey.createdAt,
        lastUsed: apiKey.lastUsed,
        expiresAt: apiKey.expiresAt,
        isActive: apiKey.isActive,
        permissions: apiKey.permissions
      };
    } catch (error) {
      logger.error('获取API密钥使用统计失败', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        apiKeyId
      });
      return null;
    }
  }
}

// 验证API密钥的中间件
export const authenticateApiKey = async (req: AuthenticatedRequest, res: any, next: any) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  try {
    const result = await ApiKeyService.validateApiKey(apiKey);

    if (!result.valid) {
      return res.status(401).json({ error: 'Invalid or expired API key' });
    }

    // 将API密钥验证结果附加到请求对象
    req.apiKey = {
      valid: true,
      user: result.user,
      permissions: result.permissions
    };

    next();
  } catch (error) {
    logger.error('API密钥验证中间件错误', {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ error: 'Server error during API key validation' });
  }
};

// 检查API密钥权限的中间件
export const requireApiKeyPermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: any, next: any) => {
    if (!req.apiKey || !req.apiKey.valid) {
      return res.status(401).json({ error: 'Valid API key required' });
    }

    const permissions = req.apiKey.permissions || [];

    if (!permissions.includes(permission)) {
      logger.warn('API密钥权限不足', {
        requiredPermission: permission,
        apiKeyPermissions: permissions,
        userId: req.apiKey.user.id
      });
      return res.status(403).json({ error: `Insufficient API key permissions. Required: ${permission}` });
    }

    next();
  };
};

// 扩展AuthenticatedRequest接口以包含API密钥信息
declare module '../middleware/enhancedAuth' {
  interface AuthenticatedRequest {
    apiKey?: {
      valid: boolean;
      user?: any;
      permissions?: string[];
    };
  }
}
