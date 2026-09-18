from datetime import date, datetime
from decimal import Decimal
from typing import Literal
import uuid

from pydantic import BaseModel, Field


class ReportMonth(BaseModel):
    year: int
    month: int
    name: str
    days_available: int
    is_current: bool
    is_closed: bool


class ReportYearResponse(BaseModel):
    year: int
    months: list[ReportMonth]


class ReportDailySummary(BaseModel):
    date: date
    cash_sales: Decimal

    general_expenses: Decimal
    utility_expenses: Decimal
    other_expenses: Decimal

    employee_salary: Decimal
    overtime: Decimal

    total_expenses: Decimal
    balance: Decimal

    has_data: bool


class ReportMonthlyResponse(BaseModel):
    year: int
    month: int
    month_name: str

    days_available: int

    total_cash_sales: Decimal
    total_general_expenses: Decimal
    total_utility_expenses: Decimal
    total_other_expenses: Decimal
    total_employee_salary: Decimal
    total_overtime: Decimal
    total_expenses: Decimal
    cash_balance: Decimal

    is_closed: bool

    days: list[ReportDailySummary]


class ReportDailyExpenseBreakdown(BaseModel):
    general: Decimal
    utility: Decimal
    other: Decimal
    employee_salary: Decimal
    overtime: Decimal
    total: Decimal


class ReportDailyResponse(BaseModel):
    date: date

    cash_sales: Decimal

    expenses: ReportDailyExpenseBreakdown

    balance: Decimal


class DailyClosingCreate(BaseModel):
    note: str | None = None


class DailyClosingResponse(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    report_date: date
    accounting_fingerprint: str
    note: str | None
    is_closed: bool
    closed_at: datetime | None


class MonthlyClosingCreate(BaseModel):
    bank_balance: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    closing_expense: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2,
    )


class MonthlyClosingUpdate(BaseModel):
    bank_balance: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    closing_expense: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )


class MonthlyClosingResponse(BaseModel):
    id: uuid.UUID
    business_id: uuid.UUID
    year: int
    month: int

    cash_balance: Decimal
    bank_balance: Decimal
    total_balance: Decimal

    closing_expense: Decimal
    pnl: Decimal

    is_closed: bool
    closed_at: datetime | None