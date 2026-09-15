import uuid
from datetime import date


from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.domains.businesses.models import Business, BusinessMember, BusinessType
from ledger.domains.sales.models import Sale
from ledger.domains.sales.schemas import SaleCreate, SaleUpdate


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


async def get_sale(
    session: AsyncSession,
    business_id: uuid.UUID,
    sale_id: uuid.UUID,
) -> Sale | None:
    result = await session.execute(
        select(Sale).where(
            Sale.id == sale_id,
            Sale.business_id == business_id,
        )
    )

    return result.scalar_one_or_none()


async def list_sales(
    session: AsyncSession,
    business_id: uuid.UUID,
) -> list[Sale]:
    result = await session.execute(
        select(Sale)
        .where(Sale.business_id == business_id)
        .order_by(Sale.sale_date.desc())
    )

    return list(result.scalars().all())


async def get_sale_by_date(
    session: AsyncSession,
    business_id: uuid.UUID,
    sale_date: date,
) -> Sale | None:
    result = await session.execute(
        select(Sale).where(
            Sale.business_id == business_id,
            Sale.sale_date == sale_date,
        )
    )

    return result.scalar_one_or_none()


async def create_sale(
    session: AsyncSession,
    business_id: uuid.UUID,
    data: SaleCreate,
) -> Sale:
    sale = Sale(
        business_id=business_id,
        sale_date=data.sale_date,
        cash_income=data.cash_income,
        bank_balance=data.bank_balance,
    )

    session.add(sale)
    await session.commit()
    await session.refresh(sale)

    return sale


async def update_sale(
    session: AsyncSession,
    sale: Sale,
    data: SaleUpdate,
) -> Sale:
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(sale, field, value)

    await session.commit()
    await session.refresh(sale)

    return sale


async def delete_sale(
    session: AsyncSession,
    sale: Sale,
) -> None:
    await session.delete(sale)
    await session.commit()