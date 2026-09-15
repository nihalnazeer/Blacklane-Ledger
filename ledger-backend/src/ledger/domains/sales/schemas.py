import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class SaleCreate(BaseModel):
    sale_date: date
    cash_income: Decimal = Field(ge=0)
    bank_balance: Decimal = Field(ge=0)


class SaleUpdate(BaseModel):
    sale_date: date | None = None
    cash_income: Decimal | None = Field(default=None, ge=0)
    bank_balance: Decimal | None = Field(default=None, ge=0)


class SaleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: uuid.UUID
    sale_date: date
    cash_income: Decimal
    bank_balance: Decimal
    created_at: datetime
    updated_at: datetime