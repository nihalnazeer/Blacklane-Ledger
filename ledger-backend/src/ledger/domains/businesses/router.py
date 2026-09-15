from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.db.session import get_db_session
from ledger.domains.auth.dependencies import get_current_user
from ledger.domains.businesses.schemas import BusinessCreate, BusinessResponse
from ledger.domains.businesses.service import (
    create_business,
    get_user_businesses,
)
from ledger.domains.users.models import User

router = APIRouter(
    prefix="/businesses",
    tags=["businesses"],
)


@router.get(
    "/mine",
    response_model=list[BusinessResponse],
)
async def list_my_businesses(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list:
    return await get_user_businesses(
        session,
        current_user.id,
    )


@router.post(
    "",
    response_model=BusinessResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_business_endpoint(
    data: BusinessCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> BusinessResponse:
    return await create_business(
        session,
        name=data.name,
        owner_id=current_user.id,
        business_type=data.business_type,
    )