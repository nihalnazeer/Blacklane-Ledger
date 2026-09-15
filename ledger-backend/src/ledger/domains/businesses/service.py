import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.domains.businesses.models import Business, BusinessMember, BusinessType


async def get_business_by_id(
    session: AsyncSession,
    business_id: uuid.UUID,
) -> Business | None:
    result = await session.execute(
        select(Business).where(Business.id == business_id)
    )
    return result.scalar_one_or_none()


async def get_user_businesses(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> list[Business]:
    result = await session.execute(
        select(Business)
        .join(BusinessMember, BusinessMember.business_id == Business.id)
        .where(
            BusinessMember.user_id == user_id,
            BusinessMember.is_active.is_(True),
            Business.is_active.is_(True),
        )
        .order_by(Business.name)
    )
    return list(result.scalars().all())


async def is_user_business_member(
    session: AsyncSession,
    user_id: uuid.UUID,
    business_id: uuid.UUID,
) -> bool:
    result = await session.execute(
        select(BusinessMember).where(
            BusinessMember.user_id == user_id,
            BusinessMember.business_id == business_id,
            BusinessMember.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none() is not None


async def create_business(
    session: AsyncSession,
    name: str,
    owner_id: uuid.UUID,
    business_type: BusinessType,
) -> Business:
    business = Business(
        name=name,
        business_type=business_type.value,
    )

    session.add(business)
    await session.flush()

    membership = BusinessMember(
        business_id=business.id,
        user_id=owner_id,
        role="owner",
    )

    session.add(membership)

    await session.commit()
    await session.refresh(business)

    return business

async def get_restaurant_business_for_user(
    session: AsyncSession,
    user_id: uuid.UUID,
    business_id: uuid.UUID,
) -> Business | None:
    result = await session.execute(
        select(Business)
        .join(BusinessMember, BusinessMember.business_id == Business.id)
        .where(
            Business.id == business_id,
            BusinessMember.user_id == user_id,
            BusinessMember.is_active.is_(True),
            Business.is_active.is_(True),
            Business.business_type == BusinessType.RESTAURANT.value,
        )
    )
    return result.scalar_one_or_none()