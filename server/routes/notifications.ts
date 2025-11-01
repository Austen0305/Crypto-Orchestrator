import express from 'express';
import nodemailer from 'nodemailer';
import { storage } from '../storage';
import { insertNotificationSchema } from '../../shared/schema';
import { AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// Email transporter for notifications
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// SMS service (placeholder - integrate with Twilio or similar)
const sendSMS = async (phoneNumber: string, message: string) => {
  // Placeholder for SMS integration
  console.log(`SMS to ${phoneNumber}: ${message}`);
  // In production, integrate with Twilio, AWS SNS, etc.
};

// Send email notification
const sendEmailNotification = async (email: string, subject: string, html: string) => {
  try {
    await emailTransporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject,
      html,
    });
  } catch (error) {
    console.error('Email notification failed:', error);
  }
};

// Get user notifications
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const notifications = await storage.getNotifications(req.user!.id);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/:id/read', async (req: AuthenticatedRequest, res) => {
  try {
    const success = await storage.markNotificationAsRead(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/read-all', async (req: AuthenticatedRequest, res) => {
  try {
    // Get all user notifications and mark them as read
    const notifications = await storage.getNotifications(req.user!.id);
    for (const notification of notifications) {
      await storage.markNotificationAsRead(notification.id);
    }
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// Delete notification
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const success = await storage.deleteNotification(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Get notification preferences (placeholder - return default preferences)
router.get('/preferences', async (req: AuthenticatedRequest, res) => {
  try {
    // Placeholder - in production, store preferences in database
    const preferences = {
      email: true,
      sms: false,
      push: true,
      tradeAlerts: true,
      botAlerts: true,
      marketAlerts: false,
    };
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

// Update notification preferences (placeholder)
router.patch('/preferences', async (req: AuthenticatedRequest, res) => {
  try {
    const { email, sms, push, tradeAlerts, botAlerts, marketAlerts } = req.body;
    // Placeholder - in production, save to database
    res.json({ message: 'Notification preferences updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// Create notification (internal use)
export const createNotification = async (
  userId: string,
  type: 'trade_executed' | 'bot_status_change' | 'market_alert' | 'system',
  title: string,
  message: string,
  data?: any
) => {
  try {
    const notification = await storage.createNotification({
      userId,
      type,
      title,
      message,
      data,
      read: false,
    });

    // Send external notifications based on user preferences (placeholder)
    const preferences = {
      email: true,
      sms: false,
      push: true,
      tradeAlerts: true,
      botAlerts: true,
      marketAlerts: false,
    };
    const user = await storage.getUserById(userId);

    if (user) {
      // Email notification
      if (user.email && preferences.email && ((type === 'trade_executed' && preferences.tradeAlerts) ||
                               (type === 'bot_status_change' && preferences.botAlerts) ||
                               (type === 'market_alert' && preferences.marketAlerts))) {
        await sendEmailNotification(
          user.email,
          title,
          `<h3>${title}</h3><p>${message}</p>`
        );
      }

      // SMS notification (placeholder - no phone number in schema yet)
      // if (preferences.sms && user.phoneNumber) {
      //   await sendSMS(user.phoneNumber, `${title}: ${message}`);
      // }
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

// Test notification endpoint
router.post('/test', async (req: AuthenticatedRequest, res) => {
  try {
    const { type, title, message } = req.body;
    const notification = await createNotification(
      req.user!.id,
      (type as 'trade_executed' | 'bot_status_change' | 'market_alert' | 'system') || 'system',
      title || 'Test Notification',
      message || 'This is a test notification'
    );
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

export default router;
