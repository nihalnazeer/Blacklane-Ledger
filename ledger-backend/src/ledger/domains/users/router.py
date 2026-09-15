from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.db.session import get_db_session
from ledger.domains.auth.dependencies import require_admin
from ledger.domains.users.models import User
from ledger.domains.users.schemas import UserCreate, UserResponse
from ledger.domains.users.service import create_user, get_user_by_email

router = APIRouter(
    prefix="/users",
    tags=["users"],
)


@router.get(
    "",
    response_model=list[UserResponse],
)
async def list_users(
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
) -> list[UserResponse]:
    result = await session.execute(
        select(User).order_by(User.created_at.desc())
    )

    return list(result.scalars().all())


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_user_endpoint(
    data: UserCreate,
    session: AsyncSession = Depends(get_db_session),
    _: User = Depends(require_admin),
) -> UserResponse:
    existing_user = await get_user_by_email(
        session,
        data.email,
    )

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    return await create_user(
        session,
        data,
    )