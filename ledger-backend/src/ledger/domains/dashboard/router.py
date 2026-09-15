import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.db.session import get_db_session
from ledger.domains.auth.dependencies import get_current_user
from ledger.domains.dashboard.schemas import DashboardResponse
from ledger.domains.dashboard.service import (
    get_dashboard,
    get_restaurant_business_for_user,
)
from ledger.domains.users.models import User


router = APIRouter(
    prefix="/businesses/{business_id}/dashboard",
    tags=["dashboard"],
)


@router.get(
    "",
    response_model=DashboardResponse,
)
async def get_business_dashboard(
    business_id: uuid.UUID,
    report_date: date | None = Query(
        default=None,
        description="Dashboard date. Defaults to today.",
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> DashboardResponse:
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

    return await get_dashboard(
        session,
        business_id,
        report_date,
    )