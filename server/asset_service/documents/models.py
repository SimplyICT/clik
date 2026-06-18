from pydantic import BaseModel
from typing import Optional


class DocumentCreate(BaseModel):
    asset_id: str
    file_name: str
    file_url: str
    file_type: str = "other"
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
