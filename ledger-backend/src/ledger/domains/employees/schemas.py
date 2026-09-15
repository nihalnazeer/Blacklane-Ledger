import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from ledger.domains.employees.models import (
    EmployeeFinancialEventType,
    PaymentMethod,
)


class EmployeeCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=200,
    )

    daily_salary: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=2,
    )

    payment_method: PaymentMethod = PaymentMethod.MONTHLY


class EmployeeUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
    )

    daily_salary: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=2,
    )

    payment_method: PaymentMethod | None = None

    is_active: bool | None = None

    salary_effective_from: date | None = None


class EmployeeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: uuid.UUID
    name: str
    daily_salary: Decimal
    payment_method: PaymentMethod
    is_active: bool
    created_at: datetime
    updated_at: datetime


class EmployeeSalaryHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_id: uuid.UUID
    effective_from: date
    daily_salary: Decimal
    payment_method: PaymentMethod
    created_at: datetime


class EmployeeFinancialEventCreate(BaseModel):
    event_date: date

    event_type: EmployeeFinancialEventType

    amount: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=2,
    )

    description: str = Field(
        min_length=1,
        max_length=200,
    )

    note: str | None = None


class EmployeeFinancialEventUpdate(BaseModel):
    event_date: date | None = None

    event_type: EmployeeFinancialEventType | None = None

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

    note: str | None = None


class EmployeeFinancialEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_id: uuid.UUID
    event_date: date
    event_type: EmployeeFinancialEventType
    amount: Decimal
    description: str
    note: str | None
    created_at: datetime
    updated_at: datetime


class EmployeeNoteCreate(BaseModel):
    note_date: date

    title: str = Field(
        min_length=1,
        max_length=200,
    )

    content: str = Field(
        min_length=1,
    )


class EmployeeNoteUpdate(BaseModel):
    note_date: date | None = None

    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
    )

    content: str | None = Field(
        default=None,
        min_length=1,
    )


class EmployeeNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_id: uuid.UUID
    note_date: date
    title: str
    content: str
    created_at: datetime
    updated_at: datetime


class EmployeeBalanceResponse(BaseModel):
    employee_id: uuid.UUID

    # Positive balance = business owes employee.
    # Negative balance = employee owes business.
    balance: Decimal


class EmployeeDailySummary(BaseModel):
    date: date
    salary_earned: Decimal
    overtime: Decimal
    leave_no_salary: Decimal
    payments: Decimal
    advances: Decimal
    debt_offsets: Decimal
    balance: Decimal
    has_events: bool


class EmployeeCalendarResponse(BaseModel):
    employee: EmployeeResponse
    month: str
    days: list[EmployeeDailySummary]


class EmployeeLedgerResponse(BaseModel):
    employee: EmployeeResponse
    date: date

    daily_salary: Decimal

    salary_earned: Decimal
    overtime: Decimal
    leave_no_salary: Decimal
    payments: Decimal
    advances: Decimal
    debt_offsets: Decimal

    balance: Decimal

    events: list[EmployeeFinancialEventResponse]
    notes: list[EmployeeNoteResponse]