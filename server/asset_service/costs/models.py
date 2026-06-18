from pydantic import BaseModel
from typing import Optional
from datetime import date


class CostRecord(BaseModel):
    asset_id: str
    cost_type: str
    amount: float
    description: Optional[str] = None
    recorded_date: date
