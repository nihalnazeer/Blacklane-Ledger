import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from ledger.domains.users.models import UserRole


class UserCreate(BaseModel):
    email: str
    password: str
    role: UserRole = UserRole.USER


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
