from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import os
from datetime import datetime, timezone
from typing import Optional
import logging

from shared.schema import UserPreferences, UpdateUserPreferences, Theme

logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer()

# Environment variables
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")

# Mock storage - replace with actual database implementation
class MockPreferencesStorage:
    def __init__(self):
        self.preferences = {}

    def getPreferences(self, user_id: str) -> Optional[UserPreferences]:
        return self.preferences.get(user_id)

    def createPreferences(self, user_id: str, preferences_data: dict) -> UserPreferences:
        now = datetime.now(timezone.utc).timestamp()
        preferences = UserPreferences(
            userId=user_id,
            createdAt=now,
            updatedAt=now,
            **preferences_data
        )
        self.preferences[user_id] = preferences
        return preferences

    def updatePreferences(self, user_id: str, updates: dict) -> UserPreferences:
        if user_id not in self.preferences:
            # Create default preferences if they don't exist
            self.createPreferences(user_id, {})

        prefs = self.preferences[user_id]
        for key, value in updates.items():
            if value is not None:
                setattr(prefs, key, value)

        prefs.updatedAt = datetime.now(timezone.utc).timestamp()
        return prefs

    def deletePreferences(self, user_id: str) -> bool:
        if user_id in self.preferences:
            del self.preferences[user_id]
            return True
        return False

storage = MockPreferencesStorage()

# Helper functions
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        # In a real implementation, you'd fetch the user from database
        return {"id": str(payload['id']), "email": payload.get('email')}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Routes
@router.get("/preferences", response_model=UserPreferences)
async def get_user_preferences(current_user: dict = Depends(get_current_user)):
    """Get user preferences"""
    preferences = storage.getPreferences(current_user['id'])
    if not preferences:
        # Create default preferences
        preferences = storage.createPreferences(current_user['id'], {})

    return preferences

@router.put("/preferences", response_model=UserPreferences)
async def update_user_preferences(
    updates: UpdateUserPreferences,
    current_user: dict = Depends(get_current_user)
):
    """Update user preferences"""
    update_data = updates.dict(exclude_unset=True)
    preferences = storage.updatePreferences(current_user['id'], update_data)
    logger.info(f"Updated preferences for user {current_user['id']}")
    return preferences

@router.patch("/preferences/theme")
async def update_theme(
    theme: Theme,
    current_user: dict = Depends(get_current_user)
):
    """Update user theme preference"""
    preferences = storage.updatePreferences(current_user['id'], {"theme": theme})
    return {"message": "Theme updated successfully", "theme": theme}

@router.delete("/preferences")
async def delete_user_preferences(current_user: dict = Depends(get_current_user)):
    """Delete user preferences (reset to defaults)"""
    success = storage.deletePreferences(current_user['id'])
    if not success:
        raise HTTPException(status_code=404, detail="Preferences not found")

    return {"message": "Preferences reset to defaults"}

@router.post("/preferences/reset")
async def reset_user_preferences(current_user: dict = Depends(get_current_user)):
    """Reset user preferences to defaults"""
    storage.deletePreferences(current_user['id'])
    preferences = storage.createPreferences(current_user['id'], {})
    return {"message": "Preferences reset to defaults", "preferences": preferences}