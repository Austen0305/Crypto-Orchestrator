import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import svgCaptcha from 'svg-captcha';
import nodemailer from 'nodemailer';
import { storage } from '../storage';
import { registerSchema, loginSchema } from '../../shared/schema';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authService } from '../services/authService';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Generate JWT token
const generateToken = (user: any) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
};

// Generate refresh token
const generateRefreshToken = (user: any) => {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const validated = registerSchema.parse(req.body);
    const { email, password, name } = validated;

    try {
      const result = await authService.register({ email, password, name });

      res.status(201).json({
        message: result.message,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          emailVerified: result.user.emailVerified,
        }
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Registration failed' });
    }
  } catch (error) {
    res.status(400).json({ error: 'Invalid registration data' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const validated = loginSchema.parse(req.body);
    const { email, username, password } = validated as any;

    // Find user by email or username
    let user = undefined;
    if (email) user = await storage.getUserByEmail(email);
    if (!user && username) user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    try {
      const result = await authService.login(email || username!, password);

      // Check if 2FA is enabled
      if (user.mfaEnabled && user.mfaSecret) {
        return res.json({
          requiresMfa: true,
          userId: user.id,
        });
      }

      // Generate tokens
      const token = generateToken(user);
      const refreshToken = generateRefreshToken(user);

      // Store refresh token
      await storage.storeRefreshToken(user.id, refreshToken);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token,
        refreshToken,
      });
    } catch (error) {
      return res.status(401).json({ error: error instanceof Error ? error.message : 'Login failed' });
    }
  } catch (error) {
    res.status(400).json({ error: 'Invalid login data' });
  }
});

// Verify 2FA
router.post('/verify-mfa', async (req, res) => {
  try {
    const { userId, token } = req.body;

    const user = await storage.getUserById(userId);
    if (!user || !user.mfaSecret) {
      return res.status(400).json({ error: 'Invalid user or MFA not enabled' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      return res.status(401).json({ error: 'Invalid MFA token' });
    }

    const jwtToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token
    await storage.storeRefreshToken(user.id, refreshToken);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token: jwtToken,
      refreshToken,
    });
  } catch (error) {
    res.status(400).json({ error: 'MFA verification failed' });
  }
});

// Setup 2FA
router.post('/setup-mfa', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const secret = speakeasy.generateSecret({
      name: `CryptoOrchestrator (${user.email})`,
      issuer: 'CryptoOrchestrator',
    });

    await storage.updateUser(user.id, {
      mfaSecret: secret.base32,
      mfaEnabled: false,
    });

    res.json({
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to setup MFA' });
  }
});

// Enable 2FA
router.post('/enable-mfa', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.body;
    const user = req.user!;

    const dbUser = await storage.getUserById(user.id);
    if (!dbUser || !dbUser.mfaSecret) {
      return res.status(400).json({ error: 'MFA not set up' });
    }

    const verified = speakeasy.totp.verify({
      secret: dbUser.mfaSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      return res.status(401).json({ error: 'Invalid MFA token' });
    }

    await storage.updateUser(user.id, { mfaEnabled: true });

    res.json({ message: 'MFA enabled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to enable MFA' });
  }
});

// Email verification endpoint
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const result = await authService.verifyEmail(token);

    if (result.success) {
      res.json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// Resend verification email endpoint
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await authService.resendVerificationEmail(email);

    if (result.success) {
      res.json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// CAPTCHA endpoint
router.get('/captcha', (req, res) => {
  const captcha = svgCaptcha.create({
    size: 6,
    noise: 2,
    color: true,
    background: '#f0f0f0',
  });

  // Store captcha text in session (you'd need session middleware)
  // For now, we'll return it (in production, use secure session storage)
  res.type('svg');
  res.send(captcha.data);
});

// Password reset request
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await storage.getUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      return res.json({ message: 'If the email exists, a reset link has been sent' });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { id: user.id, type: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Password Reset - CryptoOrchestrator',
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    res.json({ message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await storage.updateUser(decoded.id, { passwordHash: hashedPassword });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(400).json({ error: 'Invalid or expired reset token' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await storage.getUserById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      mfaEnabled: user.mfaEnabled,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update profile
router.patch('/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.body;
    await storage.updateUser(req.user!.id, { name });

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if refresh token exists in storage
    const storedToken = await storage.getRefreshToken(decoded.id, refreshToken);
    if (!storedToken) {
      return res.status(401).json({ error: 'Refresh token not found' });
    }

    const user = await storage.getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Generate new refresh token
    const newRefreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update refresh token in storage
    await storage.updateRefreshToken(decoded.id, refreshToken, newRefreshToken);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Logout endpoint
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await storage.removeRefreshToken(req.user!.id, refreshToken);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to logout' });
  }
});

export default router;
