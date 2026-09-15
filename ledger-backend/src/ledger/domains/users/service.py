from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.domains.auth.security import hash_password
from ledger.domains.users.models import User
from ledger.domains.users.schemas import UserCreate


async def get_user_by_email(
    session: AsyncSession,
    email: str,
) -> User | None:
    result = await session.execute(
        select(User).where(User.email == email.lower())
    )

    return result.scalar_one_or_none()


async def get_user_by_id(
    session: AsyncSession,
    user_id,
) -> User | None:
    result = await session.execute(
        select(User).where(User.id == user_id)
    )

    return result.scalar_one_or_none()


async def create_user(
    session: AsyncSession,
    data: UserCreate,
) -> User:
    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        role=data.role.value,
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    return user