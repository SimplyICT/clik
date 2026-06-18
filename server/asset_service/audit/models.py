from pydantic import BaseModel
from typing import Optional


class AuditEventCreate(BaseModel):
    asset_id: str
    event_type: str
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    details: Optional[dict] = None
