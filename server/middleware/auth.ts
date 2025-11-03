import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../services/storage'; // adjust path if different
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Check if this is a refresh token
    if (decoded.type === 'refresh') {
      return res.status(401).json({ error: 'Refresh token cannot be used for authentication' });
    }
    
    const user = await storage.getUserById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Check if this is a refresh token
      if (decoded.type === 'refresh') {
        // Skip authentication for refresh tokens in optional auth
        return next();
      }
      
      const user = await storage.getUserById(decoded.id);

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      }
    } catch (error) {
      // Ignore auth errors for optional auth
    }
  }

  next();
};

// Session management middleware
export const sessionAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Check if this is a refresh token
    if (decoded.type === 'refresh') {
      return res.status(401).json({ error: 'Refresh token cannot be used for authentication' });
    }
    
    const user = await storage.getUserById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.cookie('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};
