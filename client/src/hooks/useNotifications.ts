import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Notification } from '../../../shared/schema';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();
  const { getAuthHeaders, isAuthenticated, user } = useAuth();
  const { isConnected, sendMessage } = useWebSocket();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      const response = await fetch('/api/notifications', {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      setNotifications(data.data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notifications',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders, isAuthenticated, toast]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark notification as read',
        variant: 'destructive',
      });
    }
  }, [getAuthHeaders, toast]);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      setNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      );

      toast({
        title: 'Success',
        description: 'All notifications marked as read',
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark all notifications as read',
        variant: 'destructive',
      });
    }
  }, [getAuthHeaders, toast]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      setNotifications(prev =>
        prev.filter(notification => notification.id !== notificationId)
      );

      toast({
        title: 'Success',
        description: 'Notification deleted',
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete notification',
        variant: 'destructive',
      });
    }
  }, [getAuthHeaders, toast]);

  const createNotification = useCallback(async (
    type: Notification['type'],
    title: string,
    message: string,
    data?: Record<string, any>
  ) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          type,
          title,
          message,
          data,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create notification');
      }

      const result = await response.json();
      const newNotification = result.data;

      setNotifications(prev => [newNotification, ...prev]);

      // Show toast for new notification
      toast({
        title: newNotification.title,
        description: newNotification.message,
      });

      return newNotification;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }, [getAuthHeaders, toast]);

  // WebSocket connection for real-time notifications
  useEffect(() => {
    if (isAuthenticated && user?.token && isConnected) {
      // Send authentication message for notifications
      sendMessage({
        type: 'auth',
        token: user.token,
        subscribe: ['notifications']
      });
    }
  }, [isAuthenticated, user, isConnected, sendMessage]);

  // Handle WebSocket messages for notifications
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'initial_notifications':
            setNotifications(data.data || []);
            break;
          case 'notification':
            setNotifications(prev => [data.data, ...prev]);
            setUnreadCount(prev => prev + 1);
            break;
          case 'notification_read':
            setNotifications(prev =>
              prev.map(n =>
                n.id === data.notification_id ? { ...n, read: true } : n
              )
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
            break;
          case 'all_notifications_read':
            setNotifications(prev =>
              prev.map(n => ({ ...n, read: true }))
            );
            setUnreadCount(0);
            break;
          case 'notification_deleted':
            setNotifications(prev =>
              prev.filter(n => n.id !== data.notification_id)
            );
            break;
          case 'unread_count_update':
            setUnreadCount(data.count);
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    if (isConnected) {
      // Add event listener for WebSocket messages
      const ws = (window as any).ws || (window as any).WebSocket;
      if (ws) {
        ws.addEventListener('message', handleMessage);
      }

      return () => {
        if (ws) {
          ws.removeEventListener('message', handleMessage);
        }
      };
    }
  }, [isConnected]);

  // Fallback to polling when WebSocket is not available
  useEffect(() => {
    if (!isConnected && isAuthenticated) {
      fetchNotifications();

      const pollInterval = setInterval(() => {
        fetchNotifications();
      }, 30000); // Poll every 30 seconds

      return () => clearInterval(pollInterval);
    }
  }, [isAuthenticated, isConnected, fetchNotifications]);

  // Fetch notifications on mount and when authentication changes
  useEffect(() => {
    if (isAuthenticated && !isConnected) {
      fetchNotifications();
    } else if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, isConnected, fetchNotifications]);

  // Update unread count when notifications change (for non-WebSocket mode)
  useEffect(() => {
    if (!isConnected) {
      setUnreadCount(notifications.filter(n => !n.read).length);
    }
  }, [notifications, isConnected]);

  return {
    notifications,
    isLoading,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
  };
};
