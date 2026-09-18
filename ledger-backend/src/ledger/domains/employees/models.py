import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ledger.db.base import Base


class PaymentMethod(StrEnum):
    DAILY = "daily"
    MONTHLY = "monthly"


class EmployeeShift(StrEnum):
    """
    Employee accounting shift.

    The accounting date is the date on which the shift's employee expense
    belongs:
      - DAY:   7 AM -> 7 PM on the record date
      - NIGHT: 7 PM on the previous calendar day -> 7 AM on the record date
    """

    DAY = "day"
    NIGHT = "night"


class EmployeeAttendanceStatus(StrEnum):
    PRESENT = "present"
    LEAVE = "leave"


class EmployeeFinancialEventType(StrEnum):
    ADVANCE = "advance"
    OVERTIME = "overtime"
    LEAVE_NO_SALARY = "leave_no_salary"
    PAYMENT = "payment"
    DEBT_OFFSET = "debt_offset"


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    # The employee's salary/rate is ALWAYS a per-day amount.
    daily_salary: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    # This only controls how salary is normally paid.
    payment_method: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PaymentMethod.MONTHLY.value,
    )

    # The date from which this employee's accounting history should begin.
    #
    # This is intentionally separate from created_at:
    # - created_at = when the employee profile was created in the system
    # - accounting_start_date = when the employee's bookkeeping history begins
    accounting_start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


class EmployeeSalaryHistory(Base):
    __tablename__ = "employee_salary_history"

    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "effective_from",
            name="uq_employee_salary_history_employee_date",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    effective_from: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    daily_salary: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    payment_method: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class EmployeeDailyRecord(Base):
    """
    Manual daily employee accounting record.

    One employee can have one day-shift record and one night-shift record
    for an accounting date.

    The record stores the actual manually entered figures. The application
    does not calculate attendance, overtime, or salary from hours worked.
    """

    __tablename__ = "employee_daily_records"

    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "record_date",
            "shift",
            name="uq_employee_daily_record_employee_date_shift",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The accounting date, not necessarily the calendar date on which the
    # shift started. A night shift belongs to the following accounting date.
    record_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    shift: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=EmployeeShift.DAY.value,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=EmployeeAttendanceStatus.PRESENT.value,
    )

    # Actual base salary/rate entered for this record.
    # This is stored on the daily record so historical records remain
    # unchanged if the employee's salary changes later.
    salary_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    # Overtime is entered manually. There is no automatic hours calculation.
    overtime: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    # Salary cut/deduction entered manually for this record.
    salary_cut: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


class EmployeeFinancialEvent(Base):
    __tablename__ = "employee_financial_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    event_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


class EmployeeNote(Base):
    __tablename__ = "employee_notes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    note_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
