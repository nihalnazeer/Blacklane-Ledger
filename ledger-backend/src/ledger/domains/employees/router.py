import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.db.session import get_db_session
from ledger.domains.auth.dependencies import get_current_user
from ledger.domains.employees.schemas import (
    EmployeeBalanceResponse,
    EmployeeCalendarResponse,
    EmployeeCreate,
    EmployeeDailyRecordCreate,
    EmployeeDailyRecordResponse,
    EmployeeDailyRecordUpdate,
    EmployeeFinancialEventCreate,
    EmployeeFinancialEventResponse,
    EmployeeFinancialEventUpdate,
    EmployeeLedgerResponse,
    EmployeeNoteCreate,
    EmployeeNoteResponse,
    EmployeeNoteUpdate,
    EmployeeResponse,
    EmployeeUpdate,
)
from ledger.domains.employees.service import (
    create_employee,
    create_employee_daily_record,
    create_employee_note,
    create_financial_event,
    delete_employee,
    delete_employee_daily_record,
    delete_employee_note,
    delete_financial_event,
    get_employee,
    get_employee_balance,
    get_employee_calendar,
    get_employee_daily_record,
    get_employee_daily_record_by_date_shift,
    get_employee_ledger,
    get_employee_note,
    get_restaurant_business_for_user,
    get_financial_event,
    list_employee_daily_records,
    list_employee_notes,
    list_employees,
    list_financial_events,
    update_employee,
    update_employee_daily_record,
    update_employee_note,
    update_financial_event,
)
from ledger.domains.users.models import User


router = APIRouter(
    prefix="/businesses/{business_id}/employees",
    tags=["employees"],
)


# ---------------------------------------------------------------------------
# Access helpers
# ---------------------------------------------------------------------------


async def require_employee_business_access(
    business_id: uuid.UUID,
    current_user: User,
    session: AsyncSession,
):
    business = await get_restaurant_business_for_user(
        session,
        current_user.id,
        business_id,
    )

    if business is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant business not found or unavailable",
        )

    return business


async def require_employee_access(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    current_user: User,
    session: AsyncSession,
):
    await require_employee_business_access(
        business_id,
        current_user,
        session,
    )

    employee = await get_employee(
        session,
        business_id,
        employee_id,
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    return employee


# ---------------------------------------------------------------------------
# Employee list
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=list[EmployeeResponse],
)
async def list_employee_endpoint(
    business_id: uuid.UUID,
    include_inactive: bool = Query(False),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[EmployeeResponse]:
    await require_employee_business_access(
        business_id,
        current_user,
        session,
    )

    return await list_employees(
        session,
        business_id,
        include_inactive=include_inactive,
    )


@router.post(
    "",
    response_model=EmployeeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_employee_endpoint(
    business_id: uuid.UUID,
    data: EmployeeCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeResponse:
    await require_employee_business_access(
        business_id,
        current_user,
        session,
    )

    return await create_employee(
        session,
        business_id,
        data,
    )


# ---------------------------------------------------------------------------
# Employee balance
# ---------------------------------------------------------------------------


@router.get(
    "/{employee_id}/balance",
    response_model=EmployeeBalanceResponse,
)
async def get_employee_balance_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeBalanceResponse:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    balance = await get_employee_balance(
        session,
        employee,
    )

    return EmployeeBalanceResponse(
        employee_id=employee.id,
        balance=balance,
    )


# ---------------------------------------------------------------------------
# Employee calendar
# ---------------------------------------------------------------------------


@router.get(
    "/{employee_id}/calendar",
    response_model=EmployeeCalendarResponse,
)
async def get_employee_calendar_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeCalendarResponse:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    days = await get_employee_calendar(
        session,
        employee,
        year,
        month,
    )

    return EmployeeCalendarResponse(
        employee=employee,
        month=f"{year:04d}-{month:02d}",
        days=days,
    )


# ---------------------------------------------------------------------------
# Employee ledger / date detail
# ---------------------------------------------------------------------------


@router.get(
    "/{employee_id}/ledger",
    response_model=EmployeeLedgerResponse,
)
async def get_employee_ledger_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    ledger_date: date = Query(..., alias="date"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeLedgerResponse:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    return await get_employee_ledger(
        session,
        employee,
        ledger_date,
    )


# ---------------------------------------------------------------------------
# Employee daily records
# ---------------------------------------------------------------------------


@router.get(
    "/{employee_id}/daily-records",
    response_model=list[EmployeeDailyRecordResponse],
)
async def list_employee_daily_records_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    record_date: date | None = Query(None, alias="date"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[EmployeeDailyRecordResponse]:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    return await list_employee_daily_records(
        session,
        employee.id,
        record_date,
    )


@router.post(
    "/{employee_id}/daily-records",
    response_model=EmployeeDailyRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_employee_daily_record_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    data: EmployeeDailyRecordCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeDailyRecordResponse:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    existing = await get_employee_daily_record_by_date_shift(
        session,
        employee.id,
        data.record_date,
        data.shift,
    )

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A daily record already exists for this employee, "
                "date, and shift."
            ),
        )

    try:
        return await create_employee_daily_record(
            session,
            employee.id,
            data,
        )
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A daily record already exists for this employee, "
                "date, and shift."
            ),
        ) from exc
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to save employee daily record.",
        ) from exc


@router.get(
    "/{employee_id}/daily-records/{record_id}",
    response_model=EmployeeDailyRecordResponse,
)
async def get_employee_daily_record_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    record_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeDailyRecordResponse:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    record = await get_employee_daily_record(
        session,
        employee.id,
        record_id,
    )

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee daily record not found",
        )

    return record


@router.patch(
    "/{employee_id}/daily-records/{record_id}",
    response_model=EmployeeDailyRecordResponse,
)
async def update_employee_daily_record_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    record_id: uuid.UUID,
    data: EmployeeDailyRecordUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeDailyRecordResponse:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    record = await get_employee_daily_record(
        session,
        employee.id,
        record_id,
    )

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee daily record not found",
        )

    try:
        return await update_employee_daily_record(
            session,
            record,
            data,
        )
    except ValueError as exc:
        detail = str(exc)

        if "already exists" in detail.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=detail,
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
        ) from exc


@router.delete(
    "/{employee_id}/daily-records/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_employee_daily_record_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    record_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    record = await get_employee_daily_record(
        session,
        employee.id,
        record_id,
    )

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee daily record not found",
        )

    await delete_employee_daily_record(
        session,
        record,
    )


# ---------------------------------------------------------------------------
# Employee CRUD
# ---------------------------------------------------------------------------


@router.get(
    "/{employee_id}",
    response_model=EmployeeResponse,
)
async def get_employee_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeResponse:
    return await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )


@router.patch(
    "/{employee_id}",
    response_model=EmployeeResponse,
)
async def update_employee_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    data: EmployeeUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeResponse:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    try:
        return await update_employee(
            session,
            employee,
            data,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{employee_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_employee_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    await delete_employee(
        session,
        employee,
    )


# ---------------------------------------------------------------------------
# Financial events
# ---------------------------------------------------------------------------


@router.get(
    "/{employee_id}/financial-events",
    response_model=list[EmployeeFinancialEventResponse],
)
async def list_financial_events_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    event_date: date | None = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[EmployeeFinancialEventResponse]:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    return await list_financial_events(
        session,
        employee.id,
        event_date,
    )


@router.post(
    "/{employee_id}/financial-events",
    response_model=EmployeeFinancialEventResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_financial_event_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    data: EmployeeFinancialEventCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeFinancialEventResponse:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    try:
        return await create_financial_event(
            session,
            employee.id,
            data,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.get(
    "/{employee_id}/financial-events/{event_id}",
    response_model=EmployeeFinancialEventResponse,
)
async def get_financial_event_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeFinancialEventResponse:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    event = await get_financial_event(
        session,
        employee.id,
        event_id,
    )

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial event not found",
        )

    return event


@router.patch(
    "/{employee_id}/financial-events/{event_id}",
    response_model=EmployeeFinancialEventResponse,
)
async def update_financial_event_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    event_id: uuid.UUID,
    data: EmployeeFinancialEventUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeFinancialEventResponse:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    event = await get_financial_event(
        session,
        employee.id,
        event_id,
    )

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial event not found",
        )

    try:
        return await update_financial_event(
            session,
            event,
            data,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{employee_id}/financial-events/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_financial_event_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    event = await get_financial_event(
        session,
        employee.id,
        event_id,
    )

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial event not found",
        )

    await delete_financial_event(
        session,
        event,
    )


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------


@router.get(
    "/{employee_id}/notes",
    response_model=list[EmployeeNoteResponse],
)
async def list_notes_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[EmployeeNoteResponse]:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    return await list_employee_notes(
        session,
        employee.id,
    )


@router.post(
    "/{employee_id}/notes",
    response_model=EmployeeNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_note_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    data: EmployeeNoteCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeNoteResponse:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    return await create_employee_note(
        session,
        employee.id,
        data,
    )


@router.get(
    "/{employee_id}/notes/{note_id}",
    response_model=EmployeeNoteResponse,
)
async def get_note_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeNoteResponse:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    note = await get_employee_note(
        session,
        employee.id,
        note_id,
    )

    if note is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee note not found",
        )

    return note


@router.patch(
    "/{employee_id}/notes/{note_id}",
    response_model=EmployeeNoteResponse,
)
async def update_note_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    note_id: uuid.UUID,
    data: EmployeeNoteUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeNoteResponse:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    note = await get_employee_note(
        session,
        employee.id,
        note_id,
    )

    if note is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee note not found",
        )

    return await update_employee_note(
        session,
        note,
        data,
    )


@router.delete(
    "/{employee_id}/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_note_endpoint(
    business_id: uuid.UUID,
    employee_id: uuid.UUID,
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    employee = await require_employee_access(
        business_id,
        employee_id,
        current_user,
        session,
    )

    note = await get_employee_note(
        session,
        employee.id,
        note_id,
    )

    if note is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee note not found",
        )

    await delete_employee_note(
        session,
        note,
    )