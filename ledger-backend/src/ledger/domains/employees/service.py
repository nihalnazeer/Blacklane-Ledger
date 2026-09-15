import uuid
from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.domains.businesses.models import Business, BusinessMember, BusinessType
from ledger.domains.employees.models import (
    Employee,
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
    today = date.today()

    employee = Employee(
        business_id=business_id,
        name=data.name,
        daily_salary=data.daily_salary,
        payment_method=data.payment_method.value,
    )

    session.add(employee)

    await session.flush()

    salary_history = EmployeeSalaryHistory(
        employee_id=employee.id,
        effective_from=today,
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
    result = await session.execute(
        select(EmployeeSalaryHistory)
        .where(
            EmployeeSalaryHistory.employee_id == employee.id,
            EmployeeSalaryHistory.effective_from <= target_date,
        )
        .order_by(
            EmployeeSalaryHistory.effective_from.desc(),
        )
        .limit(1)
    )

    history = result.scalar_one_or_none()

    if history is not None:
        return history.daily_salary

    return employee.daily_salary


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


async def get_employee_balance(
    session: AsyncSession,
    employee: Employee,
    through_date: date | None = None,
) -> Decimal:
    if through_date is None:
        through_date = date.today()

    salary_start_date = employee.created_at.date()

    if salary_start_date > through_date:
        salary_earned = ZERO
    else:
        current_date = salary_start_date
        salary_earned = ZERO

        while current_date <= through_date:
            salary = await get_salary_for_date(
                session,
                employee,
                current_date,
            )

            events_result = await session.execute(
                select(EmployeeFinancialEvent).where(
                    EmployeeFinancialEvent.employee_id == employee.id,
                    EmployeeFinancialEvent.event_date == current_date,
                )
            )

            day_events = list(events_result.scalars().all())

            has_leave = any(
                event.event_type
                == EmployeeFinancialEventType.LEAVE_NO_SALARY.value
                for event in day_events
            )

            if not has_leave:
                salary_earned += salary

            current_date += timedelta(days=1)

    events_result = await session.execute(
        select(EmployeeFinancialEvent).where(
            EmployeeFinancialEvent.employee_id == employee.id,
            EmployeeFinancialEvent.event_date <= through_date,
        )
    )

    events = list(events_result.scalars().all())

    overtime = sum(
        (
            event.amount
            for event in events
            if event.event_type
            == EmployeeFinancialEventType.OVERTIME.value
        ),
        ZERO,
    )

    leave_no_salary = sum(
        (
            event.amount
            for event in events
            if event.event_type
            == EmployeeFinancialEventType.LEAVE_NO_SALARY.value
        ),
        ZERO,
    )

    payments = sum(
        (
            event.amount
            for event in events
            if event.event_type
            == EmployeeFinancialEventType.PAYMENT.value
        ),
        ZERO,
    )

    advances = sum(
        (
            event.amount
            for event in events
            if event.event_type
            == EmployeeFinancialEventType.ADVANCE.value
        ),
        ZERO,
    )

    debt_offsets = sum(
        (
            event.amount
            for event in events
            if event.event_type
            == EmployeeFinancialEventType.DEBT_OFFSET.value
        ),
        ZERO,
    )

    balance = (
        salary_earned
        + overtime
        - leave_no_salary
        - payments
        - advances
    )

    # A debt offset reduces the employee's debt and the amount
    # payable to them simultaneously, so it has no net effect
    # on the final combined balance.
    #
    # It is still returned separately in the ledger so the user
    # can see what happened.
    _ = debt_offsets

    return balance.quantize(Decimal("0.01"))


async def get_employee_day_summary(
    session: AsyncSession,
    employee: Employee,
    target_date: date,
) -> dict:
    salary = await get_salary_for_date(
        session,
        employee,
        target_date,
    )

    events_result = await session.execute(
        select(EmployeeFinancialEvent).where(
            EmployeeFinancialEvent.employee_id == employee.id,
            EmployeeFinancialEvent.event_date == target_date,
        )
    )

    events = list(events_result.scalars().all())

    has_leave = any(
        event.event_type
        == EmployeeFinancialEventType.LEAVE_NO_SALARY.value
        for event in events
    )

    salary_earned = ZERO if has_leave else salary

    overtime = sum(
        (
            event.amount
            for event in events
            if event.event_type
            == EmployeeFinancialEventType.OVERTIME.value
        ),
        ZERO,
    )

    leave_no_salary = sum(
        (
            event.amount
            for event in events
            if event.event_type
            == EmployeeFinancialEventType.LEAVE_NO_SALARY.value
        ),
        ZERO,
    )

    payments = sum(
        (
            event.amount
            for event in events
            if event.event_type
            == EmployeeFinancialEventType.PAYMENT.value
        ),
        ZERO,
    )

    advances = sum(
        (
            event.amount
            for event in events
            if event.event_type
            == EmployeeFinancialEventType.ADVANCE.value
        ),
        ZERO,
    )

    debt_offsets = sum(
        (
            event.amount
            for event in events
            if event.event_type
            == EmployeeFinancialEventType.DEBT_OFFSET.value
        ),
        ZERO,
    )

    balance = (
        salary_earned
        + overtime
        - leave_no_salary
        - payments
        - advances
    )

    return {
        "date": target_date,
        "salary_earned": salary_earned.quantize(Decimal("0.01")),
        "overtime": overtime.quantize(Decimal("0.01")),
        "leave_no_salary": leave_no_salary.quantize(Decimal("0.01")),
        "payments": payments.quantize(Decimal("0.01")),
        "advances": advances.quantize(Decimal("0.01")),
        "debt_offsets": debt_offsets.quantize(Decimal("0.01")),
        "balance": balance.quantize(Decimal("0.01")),
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

        # Only show salary once the employee actually exists.
        if current_date < employee.created_at.date():
            summary["salary_earned"] = ZERO
            summary["balance"] = ZERO

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

    return {
        "employee": employee,
        "date": target_date,
        "daily_salary": daily_salary,
        "salary_earned": summary["salary_earned"],
        "overtime": summary["overtime"],
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