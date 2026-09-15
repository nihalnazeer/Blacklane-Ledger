import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.domains.expenses.models import Expense, ExpenseType
from ledger.domains.expenses.schemas import ExpenseCreate, ExpenseUpdate


ZERO = Decimal("0.00")


async def list_expenses(
    session: AsyncSession,
    business_id: uuid.UUID,
    expense_date: date | None = None,
) -> list[Expense]:
    query = select(Expense).where(
        Expense.business_id == business_id,
    )

    if expense_date is not None:
        query = query.where(
            Expense.expense_date == expense_date,
        )

    query = query.order_by(
        Expense.expense_date.desc(),
        Expense.created_at.desc(),
    )

    result = await session.execute(query)
    return list(result.scalars().all())


async def get_expense(
    session: AsyncSession,
    business_id: uuid.UUID,
    expense_id: uuid.UUID,
) -> Expense | None:
    result = await session.execute(
        select(Expense).where(
            Expense.id == expense_id,
            Expense.business_id == business_id,
        )
    )

    return result.scalar_one_or_none()


async def create_expense(
    session: AsyncSession,
    business_id: uuid.UUID,
    data: ExpenseCreate,
) -> Expense:
    expense = Expense(
        business_id=business_id,
        expense_date=data.expense_date,
        amount=data.amount,
        description=data.description,
        expense_type=data.expense_type.value,
        note=data.note,
    )

    session.add(expense)
    await session.commit()
    await session.refresh(expense)

    return expense


async def update_expense(
    session: AsyncSession,
    expense: Expense,
    data: ExpenseUpdate,
) -> Expense:
    updates = data.model_dump(
        exclude_unset=True,
    )

    if "expense_type" in updates and updates["expense_type"] is not None:
        updates["expense_type"] = updates["expense_type"].value

    for field, value in updates.items():
        setattr(expense, field, value)

    await session.commit()
    await session.refresh(expense)

    return expense


async def delete_expense(
    session: AsyncSession,
    expense: Expense,
) -> None:
    await session.delete(expense)
    await session.commit()


async def get_daily_expense_total(
    session: AsyncSession,
    business_id: uuid.UUID,
    expense_date: date,
) -> Decimal:
    result = await session.execute(
        select(
            func.coalesce(
                func.sum(Expense.amount),
                ZERO,
            )
        ).where(
            Expense.business_id == business_id,
            Expense.expense_date == expense_date,
        )
    )

    return result.scalar_one()


async def get_monthly_expense_total(
    session: AsyncSession,
    business_id: uuid.UUID,
    year: int,
    month: int,
) -> Decimal:
    from calendar import monthrange

    first_day = date(year, month, 1)
    last_day = date(
        year,
        month,
        monthrange(year, month)[1],
    )

    result = await session.execute(
        select(
            func.coalesce(
                func.sum(Expense.amount),
                ZERO,
            )
        ).where(
            Expense.business_id == business_id,
            Expense.expense_date >= first_day,
            Expense.expense_date <= last_day,
        )
    )

    return result.scalar_one()


async def get_daily_expense_breakdown(
    session: AsyncSession,
    business_id: uuid.UUID,
    expense_date: date,
) -> dict[str, Decimal]:
    result = await session.execute(
        select(
            Expense.expense_type,
            func.coalesce(
                func.sum(Expense.amount),
                ZERO,
            ),
        )
        .where(
            Expense.business_id == business_id,
            Expense.expense_date == expense_date,
        )
        .group_by(Expense.expense_type)
    )

    breakdown = {
        ExpenseType.GENERAL.value: ZERO,
        ExpenseType.UTILITY.value: ZERO,
        ExpenseType.OTHER.value: ZERO,
    }

    for expense_type, amount in result.all():
        breakdown[expense_type] = amount

    return breakdown