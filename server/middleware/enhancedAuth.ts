import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import logger from '../services/logger';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 定义用户角色和权限
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  VIEWER = 'viewer'
}

// 为每个角色定义权限
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.USER]: [
    'read:own_data',
    'create:bot',
    'update:own_bot',
    'delete:own_bot',
    'execute:paper_trade',
    'read:public_data'
  ],
  [UserRole.MODERATOR]: [
    ...ROLE_PERMISSIONS[UserRole.USER],
    'read:all_bots',
    'update:other_bot',
    'read:analytics',
    'moderate:content'
  ],
  [UserRole.ADMIN]: [
    ...ROLE_PERMISSIONS[UserRole.MODERATOR],
    'read:all_data',
    'update:any_bot',
    'delete:any_bot',
    'execute:live_trade',
    'manage:users',
    'manage:system',
    'read:system_logs',
    'manage:api_keys'
  ],
  [UserRole.VIEWER]: [
    'read:public_data',
    'read:own_data'
  ]
};

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    name?: string;
    role?: UserRole;
    permissions?: string[];
  };
}

// 增强的令牌验证中间件
export const enhancedAuthenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await storage.getUserById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // 获取用户角色和权限
    const role = user.role as UserRole || UserRole.USER;
    const permissions = ROLE_PERMISSIONS[role] || [];

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      permissions
    };

    next();
  } catch (error) {
    logger.warn('身份验证失败', {
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// 基于角色的访问控制中间件
export const requireRole = (roles: UserRole | UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role || UserRole.USER;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      logger.warn('未授权访问尝试', {
        userId: req.user.id,
        userRole,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// 基于权限的访问控制中间件
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const permissions = req.user.permissions || [];

    if (!permissions.includes(permission)) {
      logger.warn('未授权权限访问尝试', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredPermission: permission,
        userPermissions: permissions,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      return res.status(403).json({ error: `Insufficient permissions. Required: ${permission}` });
    }

    next();
  };
};

// 资源所有权验证中间件
// Audit logging methods
export const logAuditEvent = async (event: string, userId: string, details: any): Promise<void> => {
  const auditLog = {
    id: randomUUID(),
    event,
    userId,
    details,
    timestamp: Date.now(),
    ip: details.ip || 'unknown',
    userAgent: details.userAgent || 'unknown',
  };
  
  // In a real implementation, this would be stored in a dedicated audit log table
  // For now, we'll use the logger
  logger.info('AUDIT:', auditLog);
};

export const requireOwnership = (resourceType: string, resourceIdParam: string = 'id') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const resourceId = req.params[resourceIdParam];
      let resource;

      // 根据资源类型检查所有权
      switch (resourceType) {
        case 'bot':
          resource = await storage.getBotById(resourceId);
          break;
        case 'apiKey':
          resource = await storage.getApiKeyById(resourceId);
          break;
        default:
          return res.status(500).json({ error: 'Invalid resource type' });
      }

      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      // 管理员可以访问任何资源
      if (req.user.role === UserRole.ADMIN) {
        return next();
      }

      // 检查用户是否拥有资源
      if (resource.userId !== req.user.id) {
        await logAuditEvent('unauthorized_access_attempt', req.user.id, {
          resourceId,
          resourceType,
          resourceOwner: resource.userId,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        return res.status(403).json({ error: 'Access denied: Resource not owned by user' });
      }

      next();
    } catch (error) {
      await logAuditEvent('permission_check_error', req.user.id, {
        error: error instanceof Error ? error.message : String(error),
        resourceType,
        resourceId: req.params[resourceIdParam]
      });
      return res.status(500).json({ error: 'Server error while checking permissions' });
    }
  };
};
