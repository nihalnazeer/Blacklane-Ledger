import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.db.session import get_db_session
from ledger.domains.auth.dependencies import get_current_user
from ledger.domains.sales.schemas import SaleCreate, SaleResponse, SaleUpdate
from ledger.domains.sales.service import (
    create_sale,
    delete_sale,
    get_restaurant_business_for_user,
    get_sale,
    get_sale_by_date,
    list_sales,
    update_sale,
)
from ledger.domains.users.models import User

router = APIRouter(
    prefix="/businesses/{business_id}/sales",
    tags=["restaurant sales"],
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
    response_model=list[SaleResponse],
)
async def list_business_sales(
    business_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[SaleResponse]:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    return await list_sales(
        session,
        business_id,
    )


@router.post(
    "",
    response_model=SaleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_business_sale(
    business_id: uuid.UUID,
    data: SaleCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> SaleResponse:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    existing_sale = await get_sale_by_date(
        session,
        business_id,
        data.sale_date,
    )

    if existing_sale is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A sale already exists for this date",
        )

    return await create_sale(
        session,
        business_id,
        data,
    )


@router.get(
    "/{sale_id}",
    response_model=SaleResponse,
)
async def get_business_sale(
    business_id: uuid.UUID,
    sale_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> SaleResponse:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    sale = await get_sale(
        session,
        business_id,
        sale_id,
    )

    if sale is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sale not found",
        )

    return sale


@router.patch(
    "/{sale_id}",
    response_model=SaleResponse,
)
async def update_business_sale(
    business_id: uuid.UUID,
    sale_id: uuid.UUID,
    data: SaleUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> SaleResponse:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    sale = await get_sale(
        session,
        business_id,
        sale_id,
    )

    if sale is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sale not found",
        )

    if data.sale_date is not None and data.sale_date != sale.sale_date:
        existing_sale = await get_sale_by_date(
            session,
            business_id,
            data.sale_date,
        )

        if existing_sale is not None and existing_sale.id != sale.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A sale already exists for this date",
            )

    return await update_sale(
        session,
        sale,
        data,
    )


@router.delete(
    "/{sale_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_business_sale(
    business_id: uuid.UUID,
    sale_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    await require_restaurant_access(
        business_id,
        current_user,
        session,
    )

    sale = await get_sale(
        session,
        business_id,
        sale_id,
    )

    if sale is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sale not found",
        )

    await delete_sale(
        session,
        sale,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)