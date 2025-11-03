from typing import List, Dict, Any
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

class CacheEntry(BaseModel):
    key: str
    value: Any

class CacheService:
    def __init__(self):
        self.cache: Dict[str, Any] = {}

    def set(self, key: str, value: Any):
        self.cache[key] = value

    def get(self, key: str) -> Any:
        return self.cache.get(key)
