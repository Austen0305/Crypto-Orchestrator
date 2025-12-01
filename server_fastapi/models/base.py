"""
Base database models and common functionality.
"""

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import Column, Integer, DateTime, String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.orm import DeclarativeBase

# Define Base here to avoid circular imports
class Base(DeclarativeBase):
    pass

if TYPE_CHECKING:
    from .exchange_api_key import ExchangeAPIKey

class TimestampMixin:
    """
    Mixin class providing created_at and updated_at timestamps.
    """
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

class SoftDeleteMixin:
    """
    Mixin class providing soft delete functionality.
    """
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    def soft_delete(self):
        """Mark the record as deleted."""
        self.deleted_at = datetime.utcnow()
        self.is_deleted = True

    def restore(self):
        """Restore a soft-deleted record."""
        self.deleted_at = None
        self.is_deleted = False

class BaseModel(Base, TimestampMixin, SoftDeleteMixin):
    """
    Base model class that includes common fields and mixins.
    All application models should inherit from this class.
    """
    __abstract__ = True

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    def to_dict(self) -> dict:
        """
        Convert model instance to dictionary.
        Excludes SQLAlchemy internal attributes.
        """
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
            if not column.name.startswith('_')
        }


# Re-export User from user.py for backward compatibility
# Import here to maintain the API contract for code that imports User from base
def __getattr__(name):
    """Lazy import of User to avoid circular imports."""
    if name == "User":
        from .user import User
        return User
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")