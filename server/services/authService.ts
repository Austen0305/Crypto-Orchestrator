import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { User, InsertUser, userSchema } from '../../shared/schema';
import { storage } from '../storage';
import logger from './logger';

export class AuthService {
  private jwtSecret: string;
  private jwtRefreshSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateAccessToken(user: User): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role || 'user'
      },
      this.jwtSecret,
      { expiresIn: '15m' }
    );
  }

  generateRefreshToken(user: User): string {
    return jwt.sign(
      { userId: user.id },
      this.jwtRefreshSecret,
      { expiresIn: '7d' }
    );
  }

  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      logger.error('JWT verification failed:', error);
      return null;
    }
  }

  verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtRefreshSecret);
    } catch (error) {
      logger.error('Refresh token verification failed:', error);
      return null;
    }
  }

  generate2FASecret(): { secret: string; otpauthUrl: string } {
    const secret = speakeasy.generateSecret({
      name: 'CryptoOrchestrator',
      issuer: 'CryptoOrchestrator'
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url!
    };
  }

  async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      return await qrcode.toDataURL(otpauthUrl);
    } catch (error) {
      logger.error('QR code generation failed:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  verify2FAToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 30 seconds window
    });
  }

  async register(userData: InsertUser): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(userData.email!);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const passwordHash = await this.hashPassword(userData.password!);

    // Create user
    const user = await storage.createUser({
      ...userData,
      passwordHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store refresh token
    await storage.storeRefreshToken(user.id, refreshToken);

    logger.info(`User registered: ${user.email}`);

    return { user, accessToken, refreshToken };
  }

  async login(email: string, password: string, twoFactorToken?: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    // Find user
    const user = await storage.getUserByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(password, user.passwordHash!);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Check if 2FA is enabled
    if (user.mfaEnabled && user.mfaSecret) {
      if (!twoFactorToken) {
        throw new Error('2FA token required');
      }

      const isValid2FA = this.verify2FAToken(user.mfaSecret, twoFactorToken);
      if (!isValid2FA) {
        throw new Error('Invalid 2FA token');
      }
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store refresh token
    await storage.storeRefreshToken(user.id, refreshToken);

    logger.info(`User logged in: ${user.email}`);

    return { user, accessToken, refreshToken };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const decoded = this.verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new Error('Invalid refresh token');
    }

    // Check if refresh token exists in storage
    const storedToken = await storage.getRefreshToken(decoded.userId, refreshToken);
    if (!storedToken) {
      throw new Error('Refresh token not found');
    }

    const user = await storage.getUserById(decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    // Update refresh token in storage
    await storage.updateRefreshToken(decoded.userId, refreshToken, newRefreshToken);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async enable2FA(userId: string): Promise<{ secret: string; qrCodeUrl: string }> {
    const user = await storage.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.mfaEnabled) {
      throw new Error('2FA already enabled');
    }

    const { secret, otpauthUrl } = this.generate2FASecret();
    const qrCodeUrl = await this.generateQRCode(otpauthUrl);

    // Store the secret temporarily (will be confirmed later)
    await storage.updateUser(userId, { mfaSecret: secret });

    return { secret, qrCodeUrl };
  }

  async confirm2FA(userId: string, token: string): Promise<void> {
    const user = await storage.getUserById(userId);
    if (!user || !user.mfaSecret) {
      throw new Error('2FA setup not initiated');
    }

    const isValid = this.verify2FAToken(user.mfaSecret, token);
    if (!isValid) {
      throw new Error('Invalid 2FA token');
    }

    // Enable 2FA
    await storage.updateUser(userId, { mfaEnabled: true });

    logger.info(`2FA enabled for user: ${user.email}`);
  }

  async disable2FA(userId: string, password: string): Promise<void> {
    const user = await storage.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(password, user.passwordHash!);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    await storage.updateUser(userId, { mfaEnabled: false, mfaSecret: undefined });

    logger.info(`2FA disabled for user: ${user.email}`);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await storage.removeRefreshToken(userId, refreshToken);
    logger.info(`User logged out: ${userId}`);
  }

  async getUserProfile(userId: string): Promise<User> {
    const user = await storage.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Remove sensitive data
    const { passwordHash, mfaSecret, ...profile } = user;
    return profile as User;
  }

  async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
    const user = await storage.updateUser(userId, { ...updates, updatedAt: Date.now() });
    if (!user) {
      throw new Error('User not found');
    }

    logger.info(`User profile updated: ${user.email}`);
    return user;
  }
}

export const authService = new AuthService();
