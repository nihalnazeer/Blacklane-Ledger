import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.db.session import get_db_session
from ledger.domains.auth.dependencies import get_current_user
from ledger.domains.reports.schemas import (
    MonthlyClosingCreate,
    MonthlyClosingResponse,
    MonthlyClosingUpdate,
    ReportDailyResponse,
    ReportMonthlyResponse,
    ReportYearResponse,
)
from ledger.domains.reports.service import (
    create_monthly_closing,
    get_daily_report,
    get_monthly_closing,
    get_monthly_report,
    get_restaurant_business_for_user,
    get_year_report,
    update_monthly_closing,
)
from ledger.domains.users.models import User


router = APIRouter(
    prefix="/businesses/{business_id}/reports",
    tags=["reports"],
)


async def require_restaurant_access(
    business_id: uuid.UUID,
    current_user: User,
    session: AsyncSession,
) -> None:
    business = await get_restaurant_business_for_user(
        session,
        current_user.id,
        business_id,
    )

    if business is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant business not found",
        )


def build_closing_response(
    closing,
    cash_balance: Decimal,
) -> MonthlyClosingResponse:
    total_balance = (
        cash_balance
        + closing.bank_balance
    )

    pnl = (
        total_balance
        - closing.closing_expense
    )

    return MonthlyClosingResponse(
        id=closing.id,
        business_id=closing.business_id,
        year=closing.year,
        month=closing.month,
        cash_balance=cash_balance,
        bank_balance=closing.bank_balance,
        total_balance=total_balance,
        closing_expense=closing.closing_expense,
        pnl=pnl,
        is_closed=closing.is_closed,
        closed_at=closing.closed_at,
    )


@router.get(
    "/year",
    response_model=ReportYearResponse,
)
async def get_report_year(
    business_id: uuid.UUID,
    year: int = Query(
        ...,
        ge=2000,
        le=2100,
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ReportYearResponse:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    return await get_year_report(
        session,
        business_id,
        year,
    )


@router.get(
    "/monthly",
    response_model=ReportMonthlyResponse,
)
async def get_report_month(
    business_id: uuid.UUID,
    year: int = Query(
        ...,
        ge=2000,
        le=2100,
    ),
    month: int = Query(
        ...,
        ge=1,
        le=12,
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ReportMonthlyResponse:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    return await get_monthly_report(
        session,
        business_id,
        year,
        month,
    )


@router.get(
    "/daily",
    response_model=ReportDailyResponse,
)
async def get_report_day(
    business_id: uuid.UUID,
    report_date: date = Query(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ReportDailyResponse:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    return await get_daily_report(
        session,
        business_id,
        report_date,
    )


@router.get(
    "/monthly/{year}/{month}/closing",
    response_model=MonthlyClosingResponse,
)
async def get_closing(
    business_id: uuid.UUID,
    year: int,
    month: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MonthlyClosingResponse:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    closing = await get_monthly_closing(
        session,
        business_id,
        year,
        month,
    )

    if closing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monthly report has not been closed",
        )

    monthly_report = await get_monthly_report(
        session,
        business_id,
        year,
        month,
    )

    return build_closing_response(
        closing,
        monthly_report["cash_balance"],
    )


@router.post(
    "/monthly/{year}/{month}/closing",
    response_model=MonthlyClosingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def close_month(
    business_id: uuid.UUID,
    year: int,
    month: int,
    data: MonthlyClosingCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MonthlyClosingResponse:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    if month < 1 or month > 12:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid month",
        )

    monthly_report = await get_monthly_report(
        session,
        business_id,
        year,
        month,
    )

    try:
        closing = await create_monthly_closing(
            session,
            business_id,
            year,
            month,
            data.bank_balance,
            data.closing_expense,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return build_closing_response(
        closing,
        monthly_report["cash_balance"],
    )


@router.patch(
    "/monthly/{year}/{month}/closing",
    response_model=MonthlyClosingResponse,
)
async def edit_monthly_closing(
    business_id: uuid.UUID,
    year: int,
    month: int,
    data: MonthlyClosingUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MonthlyClosingResponse:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    closing = await get_monthly_closing(
        session,
        business_id,
        year,
        month,
    )

    if closing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monthly report has not been closed",
        )

    closing = await update_monthly_closing(
        session,
        closing,
        data.bank_balance,
        data.closing_expense,
    )

    monthly_report = await get_monthly_report(
        session,
        business_id,
        year,
        month,
    )

    return build_closing_response(
        closing,
        monthly_report["cash_balance"],
    )