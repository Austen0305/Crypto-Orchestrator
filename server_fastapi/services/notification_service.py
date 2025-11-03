import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)

class NotificationPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class NotificationCategory(Enum):
    TRADE = "trade"
    BOT = "bot"
    MARKET = "market"
    SYSTEM = "system"
    PORTFOLIO = "portfolio"
    RISK = "risk"

class NotificationService:
    def __init__(self):
        self.notifications = {}  # user_id -> list of notifications
        self.notification_id_counter = 1
        self.listeners = {}  # user_id -> list of callback functions

    async def create_notification(
        self,
        user_id: int,
        message: str,
        level: str = 'info',
        title: str = None,
        category: NotificationCategory = None,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        data: Dict[str, Any] = None,
        expires_at: datetime = None
    ) -> Dict[str, Any]:
        """Create a new notification for a user with advanced features"""
        notification_id = self.notification_id_counter
        self.notification_id_counter += 1

        notification = {
            'id': notification_id,
            'user_id': user_id,
            'title': title or self._generate_title(level, category),
            'message': message,
            'level': level,  # 'info', 'warning', 'error', 'success'
            'category': category.value if category else 'system',
            'priority': priority.value,
            'data': data or {},
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'created_at': datetime.now(timezone.utc).isoformat(),
            'read': False,
            'read_at': None,
            'expires_at': expires_at.isoformat() if expires_at else None
        }

        if user_id not in self.notifications:
            self.notifications[user_id] = []

        # Remove expired notifications before adding new one
        await self._cleanup_expired_notifications(user_id)

        self.notifications[user_id].append(notification)

        logger.info(f"Created notification {notification['id']} for user {user_id}: {message}")

        # Notify listeners
        await self._notify_listeners(user_id, notification)

        return notification

    def _generate_title(self, level: str, category: NotificationCategory) -> str:
        """Generate a default title based on level and category"""
        level_titles = {
            'info': 'Information',
            'warning': 'Warning',
            'error': 'Error',
            'success': 'Success'
        }

        category_titles = {
            NotificationCategory.TRADE: 'Trade',
            NotificationCategory.BOT: 'Bot',
            NotificationCategory.MARKET: 'Market',
            NotificationCategory.SYSTEM: 'System',
            NotificationCategory.PORTFOLIO: 'Portfolio',
            NotificationCategory.RISK: 'Risk'
        }

        category_title = category_titles.get(category, 'Notification')
        level_title = level_titles.get(level, 'Notification')

        return f"{category_title} {level_title}"

    async def _cleanup_expired_notifications(self, user_id: int):
        """Remove expired notifications"""
        if user_id not in self.notifications:
            return

        current_time = datetime.now(timezone.utc)
        self.notifications[user_id] = [
            n for n in self.notifications[user_id]
            if n.get('expires_at') is None or datetime.fromisoformat(n['expires_at']) > current_time
        ]

    async def get_recent_notifications(
        self,
        user_id: int,
        limit: int = 50,
        category: NotificationCategory = None,
        unread_only: bool = False,
        priority_filter: List[NotificationPriority] = None
    ) -> List[Dict[str, Any]]:
        """Get recent notifications for a user with filtering options"""
        user_notifications = self.notifications.get(user_id, [])

        # Apply filters
        filtered = user_notifications
        if category:
            filtered = [n for n in filtered if n.get('category') == category.value]
        if unread_only:
            filtered = [n for n in filtered if not n.get('read', False)]
        if priority_filter:
            priority_values = [p.value for p in priority_filter]
            filtered = [n for n in filtered if n.get('priority') in priority_values]

        # Sort by timestamp (most recent first) and priority
        def sort_key(n):
            priority_order = {p.value: i for i, p in enumerate(NotificationPriority)}
            return (
                -priority_order.get(n.get('priority', NotificationPriority.MEDIUM.value), 1),
                -datetime.fromisoformat(n['timestamp']).timestamp()
            )

        return sorted(filtered, key=sort_key)[:limit]

    async def mark_as_read(self, user_id: int, notification_id: int) -> bool:
        """Mark a notification as read"""
        user_notifications = self.notifications.get(user_id, [])
        for notification in user_notifications:
            if notification['id'] == notification_id:
                if not notification['read']:
                    notification['read'] = True
                    notification['read_at'] = datetime.now(timezone.utc).isoformat()
                    logger.info(f"Marked notification {notification_id} as read for user {user_id}")
                return True
        return False

    async def mark_all_as_read(self, user_id: int, category: NotificationCategory = None) -> int:
        """Mark all notifications as read, optionally filtered by category"""
        user_notifications = self.notifications.get(user_id, [])
        count = 0

        for notification in user_notifications:
            if not notification.get('read', False):
                if category is None or notification.get('category') == category.value:
                    notification['read'] = True
                    notification['read_at'] = datetime.now(timezone.utc).isoformat()
                    count += 1

        logger.info(f"Marked {count} notifications as read for user {user_id}")
        return count

    async def delete_notification(self, user_id: int, notification_id: int) -> bool:
        """Delete a specific notification"""
        if user_id not in self.notifications:
            return False

        original_length = len(self.notifications[user_id])
        self.notifications[user_id] = [
            n for n in self.notifications[user_id] if n['id'] != notification_id
        ]

        deleted = len(self.notifications[user_id]) < original_length
        if deleted:
            logger.info(f"Deleted notification {notification_id} for user {user_id}")
        return deleted

    async def get_unread_count(
        self,
        user_id: int,
        category: NotificationCategory = None,
        priority_filter: List[NotificationPriority] = None
    ) -> int:
        """Get count of unread notifications with optional filters"""
        user_notifications = self.notifications.get(user_id, [])

        unread = [n for n in user_notifications if not n.get('read', False)]

        if category:
            unread = [n for n in unread if n.get('category') == category.value]
        if priority_filter:
            priority_values = [p.value for p in priority_filter]
            unread = [n for n in unread if n.get('priority') in priority_values]

        return len(unread)

    async def broadcast_notification(
        self,
        user_ids: List[int],
        message: str,
        level: str = 'info',
        title: str = None,
        category: NotificationCategory = None,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        data: Dict[str, Any] = None
    ):
        """Broadcast notification to multiple users"""
        tasks = [
            self.create_notification(
                user_id, message, level, title, category, priority, data
            )
            for user_id in user_ids
        ]
        await asyncio.gather(*tasks)

    async def add_listener(self, user_id: int, callback: callable):
        """Add a listener for real-time notification updates"""
        if user_id not in self.listeners:
            self.listeners[user_id] = []
        self.listeners[user_id].append(callback)

    async def remove_listener(self, user_id: int, callback: callable):
        """Remove a listener"""
        if user_id in self.listeners:
            self.listeners[user_id] = [cb for cb in self.listeners[user_id] if cb != callback]

    async def _notify_listeners(self, user_id: int, notification: Dict[str, Any]):
        """Notify all listeners for a user about a new notification"""
        if user_id in self.listeners:
            tasks = [cb(notification) for cb in self.listeners[user_id]]
            await asyncio.gather(*tasks, return_exceptions=True)

    async def get_notification_stats(self, user_id: int) -> Dict[str, Any]:
        """Get notification statistics for a user"""
        user_notifications = self.notifications.get(user_id, [])

        total = len(user_notifications)
        unread = len([n for n in user_notifications if not n.get('read', False)])

        # Count by category
        categories = {}
        for n in user_notifications:
            cat = n.get('category', 'system')
            categories[cat] = categories.get(cat, 0) + 1

        # Count by priority
        priorities = {}
        for n in user_notifications:
            pri = n.get('priority', NotificationPriority.MEDIUM.value)
            priorities[pri] = priorities.get(pri, 0) + 1

        return {
            'total': total,
            'unread': unread,
            'categories': categories,
            'priorities': priorities
        }