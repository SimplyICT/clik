from pydantic import BaseModel
from typing import Optional
from datetime import date


class MaintenanceScheduleCreate(BaseModel):
    asset_id: str
    title: str
    description: Optional[str] = None
    frequency_type: str
    frequency_value: int
    assigned_contractor_id: Optional[str] = None
    auto_create_work_order: bool = False


class MaintenanceScheduleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    frequency_type: Optional[str] = None
    frequency_value: Optional[int] = None
    assigned_contractor_id: Optional[str] = None
    auto_create_work_order: Optional[bool] = None
