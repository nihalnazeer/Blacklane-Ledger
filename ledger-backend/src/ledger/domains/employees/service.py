import uuid
from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.domains.businesses.models import Business, BusinessMember, BusinessType
from ledger.domains.employees.models import (
    Employee,
    EmployeeAttendanceStatus,
    EmployeeDailyRecord,
    EmployeeShift,
    EmployeeFinancialEvent,
    EmployeeFinancialEventType,
    EmployeeNote,
    EmployeeSalaryHistory,
    PaymentMethod,
)
from ledger.domains.employees.schemas import (
    EmployeeCreate,
    EmployeeFinancialEventCreate,
    EmployeeFinancialEventUpdate,
    EmployeeDailyRecordCreate,
    EmployeeDailyRecordUpdate,
    EmployeeNoteCreate,
    EmployeeNoteUpdate,
    EmployeeUpdate,
)


ZERO = Decimal("0.00")


async def get_restaurant_business_for_user(
    session: AsyncSession,
    user_id: uuid.UUID,
    business_id: uuid.UUID,
) -> Business | None:
    result = await session.execute(
        select(Business)
        .join(
            BusinessMember,
            BusinessMember.business_id == Business.id,
        )
        .where(
            Business.id == business_id,
            Business.business_type == BusinessType.RESTAURANT.value,
            Business.is_active.is_(True),
            BusinessMember.user_id == user_id,
            BusinessMember.is_active.is_(True),
        )
    )

    return result.scalar_one_or_none()


async def get_employee(
    session: AsyncSession,
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
) -> Employee | None:
    result = await session.execute(
        select(Employee).where(
            Employee.id == employee_id,
            Employee.business_id == business_id,
        )
    )

    return result.scalar_one_or_none()


async def list_employees(
    session: AsyncSession,
    business_id: uuid.UUID,
    include_inactive: bool = False,
) -> list[Employee]:
    query = select(Employee).where(
        Employee.business_id == business_id,
    )

    if not include_inactive:
        query = query.where(
            Employee.is_active.is_(True),
        )

    query = query.order_by(
        Employee.name,
    )

    result = await session.execute(query)

    return list(result.scalars().all())


async def create_employee(
    session: AsyncSession,
    business_id: uuid.UUID,
    data: EmployeeCreate,
) -> Employee:
    employee = Employee(
        business_id=business_id,
        name=data.name,
        daily_salary=data.daily_salary,
        payment_method=data.payment_method.value,
        accounting_start_date=data.accounting_start_date,
    )

    session.add(employee)

    await session.flush()

    # The employee's accounting start date is also the effective date
    # of the initial salary history entry.
    salary_history = EmployeeSalaryHistory(
        employee_id=employee.id,
        effective_from=data.accounting_start_date,
        daily_salary=data.daily_salary,
        payment_method=data.payment_method.value,
    )

    session.add(salary_history)

    await session.commit()
    await session.refresh(employee)

    return employee


async def update_employee(
    session: AsyncSession,
    employee: Employee,
    data: EmployeeUpdate,
) -> Employee:
    update_data = data.model_dump(
        exclude_unset=True,
    )

    salary_changed = (
        "daily_salary" in update_data
        or "payment_method" in update_data
    )

    if salary_changed:
        effective_from = update_data.pop(
            "salary_effective_from",
            None,
        )

        if effective_from is None:
            effective_from = date.today()

        # A salary history entry cannot become effective before the
        # employee's accounting history begins.
        if effective_from < employee.accounting_start_date:
            raise ValueError(
                "Salary effective date cannot be before the employee's "
                "accounting start date"
            )

        daily_salary = update_data.get(
            "daily_salary",
            employee.daily_salary,
        )

        payment_method = update_data.get(
            "payment_method",
            employee.payment_method,
        )

        if isinstance(payment_method, PaymentMethod):
            payment_method_value = payment_method.value
        else:
            payment_method_value = payment_method

        existing_result = await session.execute(
            select(EmployeeSalaryHistory).where(
                EmployeeSalaryHistory.employee_id == employee.id,
                EmployeeSalaryHistory.effective_from == effective_from,
            )
        )

        existing_history = existing_result.scalar_one_or_none()

        if existing_history is None:
            session.add(
                EmployeeSalaryHistory(
                    employee_id=employee.id,
                    effective_from=effective_from,
                    daily_salary=daily_salary,
                    payment_method=payment_method_value,
                )
            )
        else:
            existing_history.daily_salary = daily_salary
            existing_history.payment_method = payment_method_value

        if "daily_salary" in update_data:
            employee.daily_salary = daily_salary

        if "payment_method" in update_data:
            employee.payment_method = payment_method_value

        update_data.pop("daily_salary", None)
        update_data.pop("payment_method", None)

    else:
        update_data.pop(
            "salary_effective_from",
            None,
        )

    for field, value in update_data.items():
        setattr(employee, field, value)

    await session.commit()
    await session.refresh(employee)

    return employee


async def delete_employee(
    session: AsyncSession,
    employee: Employee,
) -> None:
    await session.delete(employee)
    await session.commit()


async def get_salary_for_date(
    session: AsyncSession,
    employee: Employee,
    target_date: date,
) -> Decimal:
    """
    Return the employee's applicable salary rate for a date.

    Important accounting rules:
    - created_at is never used here.
    - Dates before accounting_start_date have no applicable salary.
    - Salary history determines the applicable rate on or after
      accounting_start_date.
    - employee.daily_salary remains a compatibility fallback for
      legacy employees that may not have a salary-history row.
    """

    if target_date < employee.accounting_start_date:
        return ZERO

    result = await session.execute(
        select(EmployeeSalaryHistory)
        .where(
            EmployeeSalaryHistory.employee_id == employee.id,
            EmployeeSalaryHistory.effective_from <= target_date,
            EmployeeSalaryHistory.effective_from
            >= employee.accounting_start_date,
        )
        .order_by(
            EmployeeSalaryHistory.effective_from.desc(),
        )
        .limit(1)
    )

    history = result.scalar_one_or_none()

    if history is not None:
        return history.daily_salary

    # Compatibility fallback for existing employees whose initial
    # salary-history row may be missing. This is only allowed on or
    # after the employee's accounting start date.
    return employee.daily_salary


# ---------------------------------------------------------------------------
# Daily employee records
# ---------------------------------------------------------------------------


async def get_employee_daily_record(
    session: AsyncSession,
    employee_id: uuid.UUID,
    record_id: uuid.UUID,
) -> EmployeeDailyRecord | None:
    result = await session.execute(
        select(EmployeeDailyRecord).where(
            EmployeeDailyRecord.id == record_id,
            EmployeeDailyRecord.employee_id == employee_id,
        )
    )

    return result.scalar_one_or_none()


async def get_employee_daily_record_by_date_shift(
    session: AsyncSession,
    employee_id: uuid.UUID,
    record_date: date,
    shift: EmployeeShift,
) -> EmployeeDailyRecord | None:
    result = await session.execute(
        select(EmployeeDailyRecord).where(
            EmployeeDailyRecord.employee_id == employee_id,
            EmployeeDailyRecord.record_date == record_date,
            EmployeeDailyRecord.shift == shift.value,
        )
    )

    return result.scalar_one_or_none()


async def list_employee_daily_records(
    session: AsyncSession,
    employee_id: uuid.UUID,
    record_date: date | None = None,
) -> list[EmployeeDailyRecord]:
    query = select(EmployeeDailyRecord).where(
        EmployeeDailyRecord.employee_id == employee_id,
    )

    if record_date is not None:
        query = query.where(
            EmployeeDailyRecord.record_date == record_date,
        )

    query = query.order_by(
        EmployeeDailyRecord.record_date.desc(),
        EmployeeDailyRecord.shift,
        EmployeeDailyRecord.created_at.desc(),
    )

    result = await session.execute(query)

    return list(result.scalars().all())


async def create_employee_daily_record(
    session: AsyncSession,
    employee: Employee,
    data: EmployeeDailyRecordCreate,
) -> EmployeeDailyRecord:
    # Attendance/accounting cannot exist before the employee's
    # accounting start date.
    if data.record_date < employee.accounting_start_date:
        raise ValueError(
            "Daily record date cannot be before the employee's "
            "accounting start date"
        )

    existing = await get_employee_daily_record_by_date_shift(
        session,
        employee.id,
        data.record_date,
        data.shift,
    )

    if existing is not None:
        raise ValueError(
            "An employee daily record already exists for this date and shift"
        )

    record = EmployeeDailyRecord(
        employee_id=employee.id,
        record_date=data.record_date,
        shift=data.shift.value,
        status=data.status.value,
        salary_amount=data.salary_amount,
        overtime=data.overtime,
        salary_cut=data.salary_cut,
    )

    session.add(record)

    await session.commit()
    await session.refresh(record)

    return record


async def update_employee_daily_record(
    session: AsyncSession,
    record: EmployeeDailyRecord,
    data: EmployeeDailyRecordUpdate,
) -> EmployeeDailyRecord:
    update_data = data.model_dump(
        exclude_unset=True,
    )

    employee = await session.get(
        Employee,
        record.employee_id,
    )

    if employee is None:
        raise ValueError(
            "Employee associated with this daily record was not found"
        )

    if "record_date" in update_data:
        if update_data["record_date"] < employee.accounting_start_date:
            raise ValueError(
                "Daily record date cannot be before the employee's "
                "accounting start date"
            )

    new_record_date = update_data.get(
        "record_date",
        record.record_date,
    )

    new_shift = update_data.get(
        "shift",
        record.shift,
    )

    if isinstance(new_shift, EmployeeShift):
        new_shift_value = new_shift.value
    else:
        new_shift_value = new_shift

    duplicate_result = await session.execute(
        select(EmployeeDailyRecord).where(
            EmployeeDailyRecord.employee_id == record.employee_id,
            EmployeeDailyRecord.record_date == new_record_date,
            EmployeeDailyRecord.shift == new_shift_value,
            EmployeeDailyRecord.id != record.id,
        )
    )

    duplicate = duplicate_result.scalar_one_or_none()

    if duplicate is not None:
        raise ValueError(
            "An employee daily record already exists for this date and shift"
        )

    if "shift" in update_data:
        update_data["shift"] = new_shift_value

    if "status" in update_data:
        update_data["status"] = update_data["status"].value

    for field, value in update_data.items():
        setattr(record, field, value)

    await session.commit()
    await session.refresh(record)

    return record


async def delete_employee_daily_record(
    session: AsyncSession,
    record: EmployeeDailyRecord,
) -> None:
    await session.delete(record)
    await session.commit()


# ---------------------------------------------------------------------------
# Financial events
# ---------------------------------------------------------------------------


async def get_financial_event(
    session: AsyncSession,
    employee_id: uuid.UUID,
    event_id: uuid.UUID,
) -> EmployeeFinancialEvent | None:
    result = await session.execute(
        select(EmployeeFinancialEvent).where(
            EmployeeFinancialEvent.id == event_id,
            EmployeeFinancialEvent.employee_id == employee_id,
        )
    )

    return result.scalar_one_or_none()


async def list_financial_events(
    session: AsyncSession,
    employee_id: uuid.UUID,
    event_date: date | None = None,
) -> list[EmployeeFinancialEvent]:
    query = select(EmployeeFinancialEvent).where(
        EmployeeFinancialEvent.employee_id == employee_id,
    )

    if event_date is not None:
        query = query.where(
            EmployeeFinancialEvent.event_date == event_date,
        )

    query = query.order_by(
        EmployeeFinancialEvent.event_date.desc(),
        EmployeeFinancialEvent.created_at.desc(),
    )

    result = await session.execute(query)

    return list(result.scalars().all())


async def create_financial_event(
    session: AsyncSession,
    employee_id: uuid.UUID,
    data: EmployeeFinancialEventCreate,
) -> EmployeeFinancialEvent:
    employee = await session.get(
        Employee,
        employee_id,
    )

    if employee is None:
        raise ValueError(
            "Employee associated with this financial event was not found"
        )

    # All employee financial activity belongs to the employee's
    # accounting history and cannot precede accounting_start_date.
    if data.event_date < employee.accounting_start_date:
        raise ValueError(
            "Financial event date cannot be before the employee's "
            "accounting start date"
        )

    event = EmployeeFinancialEvent(
        employee_id=employee_id,
        event_date=data.event_date,
        event_type=data.event_type.value,
        amount=data.amount,
        description=data.description,
        note=data.note,
    )

    session.add(event)

    await session.commit()
    await session.refresh(event)

    return event


async def update_financial_event(
    session: AsyncSession,
    event: EmployeeFinancialEvent,
    data: EmployeeFinancialEventUpdate,
) -> EmployeeFinancialEvent:
    update_data = data.model_dump(
        exclude_unset=True,
    )

    employee = await session.get(
        Employee,
        event.employee_id,
    )

    if employee is None:
        raise ValueError(
            "Employee associated with this financial event was not found"
        )

    if "event_date" in update_data:
        if update_data["event_date"] < employee.accounting_start_date:
            raise ValueError(
                "Financial event date cannot be before the employee's "
                "accounting start date"
            )

    if "event_type" in update_data:
        update_data["event_type"] = update_data["event_type"].value

    for field, value in update_data.items():
        setattr(event, field, value)

    await session.commit()
    await session.refresh(event)

    return event


async def delete_financial_event(
    session: AsyncSession,
    event: EmployeeFinancialEvent,
) -> None:
    await session.delete(event)
    await session.commit()


# ---------------------------------------------------------------------------
# Employee accounting helpers
# ---------------------------------------------------------------------------


async def _get_daily_records_for_range(
    session: AsyncSession,
    employee: Employee,
    start_date: date,
    end_date: date,
) -> list[EmployeeDailyRecord]:
    if start_date > end_date:
        return []

    result = await session.execute(
        select(EmployeeDailyRecord)
        .where(
            EmployeeDailyRecord.employee_id == employee.id,
            EmployeeDailyRecord.record_date >= start_date,
            EmployeeDailyRecord.record_date <= end_date,
        )
        .order_by(
            EmployeeDailyRecord.record_date,
            EmployeeDailyRecord.shift,
        )
    )

    return list(result.scalars().all())


async def _get_financial_events_for_range(
    session: AsyncSession,
    employee: Employee,
    start_date: date,
    end_date: date,
) -> list[EmployeeFinancialEvent]:
    if start_date > end_date:
        return []

    result = await session.execute(
        select(EmployeeFinancialEvent)
        .where(
            EmployeeFinancialEvent.employee_id == employee.id,
            EmployeeFinancialEvent.event_date >= start_date,
            EmployeeFinancialEvent.event_date <= end_date,
        )
        .order_by(
            EmployeeFinancialEvent.event_date,
            EmployeeFinancialEvent.created_at,
        )
    )

    return list(result.scalars().all())


def _sum_event_amount(
    events: list[EmployeeFinancialEvent],
    event_type: EmployeeFinancialEventType,
) -> Decimal:
    return sum(
        (
            event.amount
            for event in events
            if event.event_type == event_type.value
        ),
        ZERO,
    )


def _daily_record_salary(
    records: list[EmployeeDailyRecord],
) -> Decimal:
    return sum(
        (
            record.salary_amount
            for record in records
            if record.status == EmployeeAttendanceStatus.PRESENT.value
        ),
        ZERO,
    )


def _daily_record_overtime(
    records: list[EmployeeDailyRecord],
) -> Decimal:
    return sum(
        (
            record.overtime
            for record in records
            if record.status == EmployeeAttendanceStatus.PRESENT.value
        ),
        ZERO,
    )


def _daily_record_salary_cut(
    records: list[EmployeeDailyRecord],
) -> Decimal:
    return sum(
        (
            record.salary_cut
            for record in records
            if record.status == EmployeeAttendanceStatus.PRESENT.value
        ),
        ZERO,
    )


async def get_employee_balance(
    session: AsyncSession,
    employee: Employee,
    through_date: date | None = None,
) -> Decimal:
    if through_date is None:
        through_date = date.today()

    # No employee accounting exists before the accounting start date.
    if through_date < employee.accounting_start_date:
        return ZERO

    daily_records = await _get_daily_records_for_range(
        session,
        employee,
        employee.accounting_start_date,
        through_date,
    )

    events = await _get_financial_events_for_range(
        session,
        employee,
        employee.accounting_start_date,
        through_date,
    )

    salary_earned = _daily_record_salary(daily_records)
    overtime = _daily_record_overtime(daily_records)
    salary_cut = _daily_record_salary_cut(daily_records)

    payments = _sum_event_amount(
        events,
        EmployeeFinancialEventType.PAYMENT,
    )

    advances = _sum_event_amount(
        events,
        EmployeeFinancialEventType.ADVANCE,
    )

    leave_no_salary = _sum_event_amount(
        events,
        EmployeeFinancialEventType.LEAVE_NO_SALARY,
    )

    debt_offsets = _sum_event_amount(
        events,
        EmployeeFinancialEventType.DEBT_OFFSET,
    )

    # Daily records contain the actual manually recorded salary amount.
    # Salary history determines the applicable rate, but does not itself
    # create earned salary.
    #
    # Leave records do not contribute salary.
    #
    # Financial-event debt/advance behavior remains as in the existing
    # system for this iteration. Debt offsets are reported separately but
    # do not alter the combined balance yet.
    balance = (
        salary_earned
        + overtime
        - salary_cut
        - leave_no_salary
        - payments
        - advances
    )

    _ = debt_offsets

    return balance.quantize(Decimal("0.01"))


async def get_employee_day_summary(
    session: AsyncSession,
    employee: Employee,
    target_date: date,
) -> dict:
    # A date before accounting_start_date is outside the employee's
    # accounting history. Return a completely neutral accounting summary.
    if target_date < employee.accounting_start_date:
        return {
            "date": target_date,
            "salary_earned": ZERO,
            "overtime": ZERO,
            "salary_cut": ZERO,
            "leave_no_salary": ZERO,
            "payments": ZERO,
            "advances": ZERO,
            "debt_offsets": ZERO,
            "balance": ZERO,
            "has_record": False,
            "has_events": False,
        }

    records = await list_employee_daily_records(
        session,
        employee.id,
        target_date,
    )

    events = await list_financial_events(
        session,
        employee.id,
        target_date,
    )

    salary_earned = _daily_record_salary(records)
    overtime = _daily_record_overtime(records)
    salary_cut = _daily_record_salary_cut(records)

    leave_no_salary = _sum_event_amount(
        events,
        EmployeeFinancialEventType.LEAVE_NO_SALARY,
    )

    payments = _sum_event_amount(
        events,
        EmployeeFinancialEventType.PAYMENT,
    )

    advances = _sum_event_amount(
        events,
        EmployeeFinancialEventType.ADVANCE,
    )

    debt_offsets = _sum_event_amount(
        events,
        EmployeeFinancialEventType.DEBT_OFFSET,
    )

    balance = (
        salary_earned
        + overtime
        - salary_cut
        - leave_no_salary
        - payments
        - advances
    )

    return {
        "date": target_date,
        "salary_earned": salary_earned.quantize(Decimal("0.01")),
        "overtime": overtime.quantize(Decimal("0.01")),
        "salary_cut": salary_cut.quantize(Decimal("0.01")),
        "leave_no_salary": leave_no_salary.quantize(Decimal("0.01")),
        "payments": payments.quantize(Decimal("0.01")),
        "advances": advances.quantize(Decimal("0.01")),
        "debt_offsets": debt_offsets.quantize(Decimal("0.01")),
        "balance": balance.quantize(Decimal("0.01")),
        "has_record": bool(records),
        "has_events": bool(events),
    }


async def get_employee_calendar(
    session: AsyncSession,
    employee: Employee,
    year: int,
    month: int,
) -> list[dict]:
    today = date.today()

    first_day = date(
        year,
        month,
        1,
    )

    last_day = date(
        year,
        month,
        monthrange(year, month)[1],
    )

    # Current month only goes through today.
    if year == today.year and month == today.month:
        last_day = today

    # Future months have no dates.
    if first_day > today:
        return []

    if last_day > today:
        last_day = today

    days: list[dict] = []

    current_date = first_day

    while current_date <= last_day:
        summary = await get_employee_day_summary(
            session,
            employee,
            current_date,
        )

        # Dates before accounting start are outside the employee's
        # bookkeeping history. The day-summary function already returns
        # zero activity for these dates, so no salary can be inferred
        # from employee existence or salary history.
        if current_date < employee.accounting_start_date:
            summary["salary_earned"] = ZERO
            summary["overtime"] = ZERO
            summary["salary_cut"] = ZERO
            summary["leave_no_salary"] = ZERO
            summary["payments"] = ZERO
            summary["advances"] = ZERO
            summary["debt_offsets"] = ZERO
            summary["balance"] = ZERO
            summary["has_record"] = False
            summary["has_events"] = False

        days.append(summary)

        current_date += timedelta(days=1)

    return days


async def get_employee_ledger(
    session: AsyncSession,
    employee: Employee,
    target_date: date,
) -> dict:
    summary = await get_employee_day_summary(
        session,
        employee,
        target_date,
    )

    balance = await get_employee_balance(
        session,
        employee,
        through_date=target_date,
    )

    records = await list_employee_daily_records(
        session,
        employee.id,
        target_date,
    )

    events_result = await session.execute(
        select(EmployeeFinancialEvent)
        .where(
            EmployeeFinancialEvent.employee_id == employee.id,
            EmployeeFinancialEvent.event_date == target_date,
        )
        .order_by(
            EmployeeFinancialEvent.created_at.desc(),
        )
    )

    events = list(events_result.scalars().all())

    notes_result = await session.execute(
        select(EmployeeNote)
        .where(
            EmployeeNote.employee_id == employee.id,
            EmployeeNote.note_date == target_date,
        )
        .order_by(
            EmployeeNote.created_at.desc(),
        )
    )

    notes = list(notes_result.scalars().all())

    daily_salary = await get_salary_for_date(
        session,
        employee,
        target_date,
    )

    # Dates before accounting_start_date are outside the employee's
    # accounting history. Do not expose salary/accounting data for them.
    if target_date < employee.accounting_start_date:
        records = []
        events = []
        daily_salary = ZERO
        balance = ZERO

    return {
        "employee": employee,
        "date": target_date,
        "daily_salary": daily_salary,
        "daily_records": records,
        "salary_earned": summary["salary_earned"],
        "overtime": summary["overtime"],
        "salary_cut": summary["salary_cut"],
        "leave_no_salary": summary["leave_no_salary"],
        "payments": summary["payments"],
        "advances": summary["advances"],
        "debt_offsets": summary["debt_offsets"],
        "balance": balance,
        "events": events,
        "notes": notes,
    }


async def create_employee_note(
    session: AsyncSession,
    employee_id: uuid.UUID,
    data: EmployeeNoteCreate,
) -> EmployeeNote:
    note = EmployeeNote(
        employee_id=employee_id,
        note_date=data.note_date,
        title=data.title,
        content=data.content,
    )

    session.add(note)

    await session.commit()
    await session.refresh(note)

    return note


async def get_employee_note(
    session: AsyncSession,
    employee_id: uuid.UUID,
    note_id: uuid.UUID,
) -> EmployeeNote | None:
    result = await session.execute(
        select(EmployeeNote).where(
            EmployeeNote.id == note_id,
            EmployeeNote.employee_id == employee_id,
        )
    )

    return result.scalar_one_or_none()


async def list_employee_notes(
    session: AsyncSession,
    employee_id: uuid.UUID,
) -> list[EmployeeNote]:
    result = await session.execute(
        select(EmployeeNote)
        .where(
            EmployeeNote.employee_id == employee_id,
        )
        .order_by(
            EmployeeNote.note_date.desc(),
            EmployeeNote.created_at.desc(),
        )
    )

    return list(result.scalars().all())


async def update_employee_note(
    session: AsyncSession,
    note: EmployeeNote,
    data: EmployeeNoteUpdate,
) -> EmployeeNote:
    update_data = data.model_dump(
        exclude_unset=True,
    )

    for field, value in update_data.items():
        setattr(note, field, value)

    await session.commit()
    await session.refresh(note)

    return note


async def delete_employee_note(
    session: AsyncSession,
    note: EmployeeNote,
) -> None:
    await session.delete(note)
    await session.commit()