import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from ledger.domains.employees.models import (
    EmployeeAttendanceStatus,
    EmployeeFinancialEventType,
    EmployeeShift,
    PaymentMethod,
)


# ---------------------------------------------------------------------------
# Employee
# ---------------------------------------------------------------------------


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

    # The date from which employee accounting should begin.
    #
    # This is intentionally independent of the employee profile's
    # created_at timestamp.
    accounting_start_date: date


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

    accounting_start_date: date | None = None


class EmployeeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    business_id: uuid.UUID
    name: str
    daily_salary: Decimal
    payment_method: PaymentMethod
    accounting_start_date: date
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Salary history
# ---------------------------------------------------------------------------


class EmployeeSalaryHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_id: uuid.UUID
    effective_from: date
    daily_salary: Decimal
    payment_method: PaymentMethod
    created_at: datetime


# ---------------------------------------------------------------------------
# Employee daily records
# ---------------------------------------------------------------------------


class EmployeeDailyRecordCreate(BaseModel):
    """
    Create the employee's manual daily accounting record.

    Salary, overtime, and salary cut are entered manually.
    The application does not calculate overtime from hours worked.
    """

    record_date: date

    shift: EmployeeShift = EmployeeShift.DAY

    status: EmployeeAttendanceStatus = EmployeeAttendanceStatus.PRESENT

    salary_amount: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    overtime: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    salary_cut: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        max_digits=12,
        decimal_places=2,
    )


class EmployeeDailyRecordUpdate(BaseModel):
    record_date: date | None = None

    shift: EmployeeShift | None = None

    status: EmployeeAttendanceStatus | None = None

    salary_amount: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    overtime: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    salary_cut: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )


class EmployeeDailyRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_id: uuid.UUID
    record_date: date
    shift: EmployeeShift
    status: EmployeeAttendanceStatus
    salary_amount: Decimal
    overtime: Decimal
    salary_cut: Decimal
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Financial events
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Employee balance
# ---------------------------------------------------------------------------


class EmployeeBalanceResponse(BaseModel):
    employee_id: uuid.UUID

    # Positive balance = business owes employee.
    # Negative balance = employee owes business.
    balance: Decimal


# ---------------------------------------------------------------------------
# Employee daily summary
# ---------------------------------------------------------------------------


class EmployeeDailySummary(BaseModel):
    date: date

    # Daily employee accounting.
    salary_earned: Decimal
    overtime: Decimal
    salary_cut: Decimal

    # Financial events associated with the date.
    leave_no_salary: Decimal
    payments: Decimal
    advances: Decimal
    debt_offsets: Decimal

    balance: Decimal

    # Whether a manual daily employee record exists for the date.
    has_record: bool

    # Whether any financial events exist for the date.
    has_events: bool


# ---------------------------------------------------------------------------
# Employee calendar
# ---------------------------------------------------------------------------


class EmployeeCalendarResponse(BaseModel):
    employee: EmployeeResponse
    month: str
    days: list[EmployeeDailySummary]


# ---------------------------------------------------------------------------
# Employee ledger / date detail
# ---------------------------------------------------------------------------


class EmployeeLedgerResponse(BaseModel):
    employee: EmployeeResponse
    date: date

    daily_salary: Decimal

    # Daily accounting record.
    daily_records: list[EmployeeDailyRecordResponse]

    salary_earned: Decimal
    overtime: Decimal
    salary_cut: Decimal

    # Financial events.
    leave_no_salary: Decimal
    payments: Decimal
    advances: Decimal
    debt_offsets: Decimal

    balance: Decimal

    events: list[EmployeeFinancialEventResponse]
    notes: list[EmployeeNoteResponse]