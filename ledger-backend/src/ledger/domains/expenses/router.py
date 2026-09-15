import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.db.session import get_db_session
from ledger.domains.auth.dependencies import get_current_user
from ledger.domains.businesses.service import get_restaurant_business_for_user
from ledger.domains.expenses.schemas import (
    DailyExpenseTotalResponse,
    ExpenseCreate,
    ExpenseResponse,
    ExpenseUpdate,
    MonthlyExpenseTotalResponse,
)
from ledger.domains.expenses.service import (
    create_expense,
    delete_expense,
    get_daily_expense_total,
    get_expense,
    get_monthly_expense_total,
    list_expenses,
    update_expense,
)
from ledger.domains.users.models import User


router = APIRouter(
    prefix="/businesses/{business_id}/expenses",
    tags=["expenses"],
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


@router.get(
    "",
    response_model=list[ExpenseResponse],
)
async def get_expenses(
    business_id: uuid.UUID,
    expense_date: date | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[ExpenseResponse]:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    return await list_expenses(
        session,
        business_id,
        expense_date,
    )


@router.post(
    "",
    response_model=ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_expense(
    business_id: uuid.UUID,
    data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ExpenseResponse:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    return await create_expense(
        session,
        business_id,
        data,
    )


@router.get(
    "/daily-total",
    response_model=DailyExpenseTotalResponse,
)
async def get_daily_total(
    business_id: uuid.UUID,
    expense_date: date = Query(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> DailyExpenseTotalResponse:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    total = await get_daily_expense_total(
        session,
        business_id,
        expense_date,
    )

    return DailyExpenseTotalResponse(
        business_id=business_id,
        expense_date=expense_date,
        total=total,
    )


@router.get(
    "/monthly-total",
    response_model=MonthlyExpenseTotalResponse,
)
async def get_monthly_total(
    business_id: uuid.UUID,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MonthlyExpenseTotalResponse:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    total = await get_monthly_expense_total(
        session,
        business_id,
        year,
        month,
    )

    return MonthlyExpenseTotalResponse(
        business_id=business_id,
        year=year,
        month=month,
        total=total,
    )


@router.get(
    "/{expense_id}",
    response_model=ExpenseResponse,
)
async def get_single_expense(
    business_id: uuid.UUID,
    expense_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ExpenseResponse:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    expense = await get_expense(
        session,
        business_id,
        expense_id,
    )

    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    return expense


@router.patch(
    "/{expense_id}",
    response_model=ExpenseResponse,
)
async def edit_expense(
    business_id: uuid.UUID,
    expense_id: uuid.UUID,
    data: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ExpenseResponse:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    expense = await get_expense(
        session,
        business_id,
        expense_id,
    )

    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    return await update_expense(
        session,
        expense,
        data,
    )


@router.delete(
    "/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_expense(
    business_id: uuid.UUID,
    expense_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    expense = await get_expense(
        session,
        business_id,
        expense_id,
    )

    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )

    await delete_expense(
        session,
        expense,
    )