from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from uuid import UUID

class AssetCreate(BaseModel):
    asset_name: str
    asset_code: str
    category: str = "Other"
    sub_category: Optional[str] = None
    status: str = "Active"
    criticality: str = "Medium"
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    customer_id: Optional[str] = None
    customer_location_id: Optional[str] = None
    assigned_contractor_id: Optional[str] = None
    parent_asset_id: Optional[str] = None
    install_date: Optional[date] = None
    purchase_date: Optional[date] = None
    warranty_expiry_date: Optional[date] = None
    notes: Optional[str] = None
    custom_fields: Optional[dict] = None

class AssetUpdate(BaseModel):
    asset_name: Optional[str] = None
    status: Optional[str] = None
    criticality: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    customer_id: Optional[str] = None
    customer_location_id: Optional[str] = None
    assigned_contractor_id: Optional[str] = None
    install_date: Optional[date] = None
    purchase_date: Optional[date] = None
    warranty_expiry_date: Optional[date] = None
    last_service_date: Optional[date] = None
    next_service_date: Optional[date] = None
    notes: Optional[str] = None
    custom_fields: Optional[dict] = None
    photo_urls: Optional[List[str]] = None

class PartCreate(BaseModel):
    asset_id: Optional[str] = None
    name: str
    sku: str
    quantity: int = 0
    min_threshold: int = 0
    unit: str = "each"

class PartUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[int] = None
    min_threshold: Optional[int] = None
    unit: Optional[str] = None

class PartUsageRecord(BaseModel):
    part_id: str
    request_id: str
    quantity: int

class JobCreate(BaseModel):
    job_type: str
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    assigned_contractor_id: Optional[str] = None

class CustomFieldDefCreate(BaseModel):
    category: str
    field_name: str
    field_label: str
    field_type: str = "text"
    options: Optional[list] = None
    required: bool = False
    sort_order: int = 0
