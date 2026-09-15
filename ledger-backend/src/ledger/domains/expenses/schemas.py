import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from ledger.domains.expenses.models import ExpenseType


class ExpenseCreate(BaseModel):
    expense_date: date
    amount: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=2,
    )
    description: str = Field(
        min_length=1,
        max_length=200,
    )
    expense_type: ExpenseType = ExpenseType.GENERAL
    note: str | None = None


class ExpenseUpdate(BaseModel):
    expense_date: date | None = None
    amount: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=2,
    )
    description: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
    )
    expense_type: ExpenseType | None = None
    note: str | None = None


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: uuid.UUID
    expense_date: date
    amount: Decimal
    description: str
    expense_type: ExpenseType
    note: str | None
    created_at: datetime
    updated_at: datetime


class DailyExpenseTotalResponse(BaseModel):
    business_id: uuid.UUID
    expense_date: date
    total: Decimal


class MonthlyExpenseTotalResponse(BaseModel):
    business_id: uuid.UUID
    year: int
    month: int
    total: Decimal