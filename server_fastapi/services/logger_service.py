from typing import List, Dict, Any
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

class LogEntry(BaseModel):
    timestamp: int
    level: str
    message: str

class LoggerService:
    def __init__(self):
        self.logs: List[LogEntry] = []

    def log(self, level: str, message: str):
        entry = LogEntry(timestamp=0, level=level, message=message)
        self.logs.append(entry)
