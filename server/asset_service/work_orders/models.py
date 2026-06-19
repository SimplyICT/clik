from pydantic import BaseModel
from typing import Optional
from datetime import date


class WorkOrderCreate(BaseModel):
    asset_id: str
    schedule_id: Optional[str] = None
    type: str
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    assigned_contractor_id: Optional[str] = None
    scheduled_date: Optional[date] = None


class WorkOrderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_contractor_id: Optional[str] = None
    scheduled_date: Optional[date] = None
    completed_date: Optional[date] = None
    completed_by: Optional[str] = None
    labor_hours: Optional[float] = None
    labor_cost: Optional[float] = None
    parts_cost: Optional[float] = None
    total_cost: Optional[float] = None
    notes: Optional[str] = None
