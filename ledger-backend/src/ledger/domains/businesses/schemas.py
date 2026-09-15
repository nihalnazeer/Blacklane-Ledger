import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from ledger.domains.businesses.models import BusinessType


class BusinessCreate(BaseModel):
    name: str
    business_type: BusinessType


class BusinessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    business_type: BusinessType
    is_active: bool
    created_at: datetime
    updated_at: datetime