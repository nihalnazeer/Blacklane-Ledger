import calendar
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.domains.businesses.models import (
    Business,
    BusinessMember,
    BusinessType,
)
from ledger.domains.employees.models import (
    Employee,
    EmployeeFinancialEvent,
    EmployeeFinancialEventType,
)
from ledger.domains.employees.service import get_salary_for_date
from ledger.domains.expenses.models import Expense, ExpenseType
from ledger.domains.reports.models import MonthlyReportClosing
from ledger.domains.sales.models import Sale


ZERO = Decimal("0.00")


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


def get_month_name(month: int) -> str:
    return calendar.month_name[month]


def get_month_dates(
    year: int,
    month: int,
) -> list[date]:
    days_in_month = calendar.monthrange(year, month)[1]

    return [
        date(year, month, day)
        for day in range(1, days_in_month + 1)
    ]


def get_available_days(
    year: int,
    month: int,
    today: date,
) -> list[date]:
    first_day = date(year, month, 1)
    last_day = date(
        year,
        month,
        calendar.monthrange(year, month)[1],
    )

    if first_day > today:
        return []

    if year == today.year and month == today.month:
        last_day = today

    if last_day > today:
        last_day = today

    days = []
    current = first_day

    while current <= last_day:
        days.append(current)
        current += timedelta(days=1)

    return days


async def get_daily_cash_sales(
    session: AsyncSession,
    business_id: uuid.UUID,
    target_date: date,
) -> Decimal:
    result = await session.execute(
        select(
            func.coalesce(
                func.sum(Sale.cash_income),
                ZERO,
            )
        ).where(
            Sale.business_id == business_id,
            Sale.sale_date == target_date,
        )
    )

    return result.scalar_one()


async def get_daily_expense_breakdown(
    session: AsyncSession,
    business_id: uuid.UUID,
    target_date: date,
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
            Expense.expense_date == target_date,
        )
        .group_by(
            Expense.expense_type,
        )
    )

    breakdown = {
        ExpenseType.GENERAL.value: ZERO,
        ExpenseType.UTILITY.value: ZERO,
        ExpenseType.OTHER.value: ZERO,
    }

    for expense_type, amount in result.all():
        breakdown[expense_type] = amount

    return breakdown


async def get_daily_employee_expenses(
    session: AsyncSession,
    business_id: uuid.UUID,
    target_date: date,
) -> tuple[Decimal, Decimal]:
    employee_result = await session.execute(
        select(Employee).where(
            Employee.business_id == business_id,
            Employee.created_at <= datetime.combine(
                target_date,
                datetime.max.time(),
            ),
        )
    )

    employees = list(
        employee_result.scalars().all()
    )

    salary_total = ZERO
    overtime_total = ZERO

    for employee in employees:
        salary = await get_salary_for_date(
            session,
            employee,
            target_date,
        )

        if salary is None:
            continue

        events_result = await session.execute(
            select(EmployeeFinancialEvent).where(
                EmployeeFinancialEvent.employee_id == employee.id,
                EmployeeFinancialEvent.event_date == target_date,
            )
        )

        events = list(
            events_result.scalars().all()
        )

        has_leave = any(
            event.event_type
            == EmployeeFinancialEventType.LEAVE_NO_SALARY.value
            for event in events
        )

        if not has_leave:
            salary_total += salary

        overtime_total += sum(
            (
                event.amount
                for event in events
                if event.event_type
                == EmployeeFinancialEventType.OVERTIME.value
            ),
            ZERO,
        )

    return salary_total, overtime_total


async def get_daily_report(
    session: AsyncSession,
    business_id: uuid.UUID,
    target_date: date,
) -> dict:
    cash_sales = await get_daily_cash_sales(
        session,
        business_id,
        target_date,
    )

    expense_breakdown = await get_daily_expense_breakdown(
        session,
        business_id,
        target_date,
    )

    employee_salary, overtime = (
        await get_daily_employee_expenses(
            session,
            business_id,
            target_date,
        )
    )

    total_expenses = (
        expense_breakdown[ExpenseType.GENERAL.value]
        + expense_breakdown[ExpenseType.UTILITY.value]
        + expense_breakdown[ExpenseType.OTHER.value]
        + employee_salary
        + overtime
    )

    balance = cash_sales - total_expenses

    return {
        "date": target_date,
        "cash_sales": cash_sales.quantize(
            Decimal("0.01")
        ),
        "expenses": {
            "general": expense_breakdown[
                ExpenseType.GENERAL.value
            ].quantize(Decimal("0.01")),
            "utility": expense_breakdown[
                ExpenseType.UTILITY.value
            ].quantize(Decimal("0.01")),
            "other": expense_breakdown[
                ExpenseType.OTHER.value
            ].quantize(Decimal("0.01")),
            "employee_salary": employee_salary.quantize(
                Decimal("0.01")
            ),
            "overtime": overtime.quantize(
                Decimal("0.01")
            ),
            "total": total_expenses.quantize(
                Decimal("0.01")
            ),
        },
        "balance": balance.quantize(
            Decimal("0.01")
        ),
    }


async def get_monthly_report(
    session: AsyncSession,
    business_id: uuid.UUID,
    year: int,
    month: int,
    today: date | None = None,
) -> dict:
    if today is None:
        today = datetime.now(UTC).date()

    days = get_available_days(
        year,
        month,
        today,
    )

    daily_reports = []

    total_cash_sales = ZERO
    total_general = ZERO
    total_utility = ZERO
    total_other = ZERO
    total_salary = ZERO
    total_overtime = ZERO

    for target_date in days:
        daily = await get_daily_report(
            session,
            business_id,
            target_date,
        )

        expenses = daily["expenses"]

        total_cash_sales += daily["cash_sales"]
        total_general += expenses["general"]
        total_utility += expenses["utility"]
        total_other += expenses["other"]
        total_salary += expenses["employee_salary"]
        total_overtime += expenses["overtime"]

        total_expenses = expenses["total"]
        balance = daily["balance"]

        daily_reports.append(
            {
                "date": target_date,
                "cash_sales": daily["cash_sales"],
                "general_expenses": expenses["general"],
                "utility_expenses": expenses["utility"],
                "other_expenses": expenses["other"],
                "employee_salary": expenses[
                    "employee_salary"
                ],
                "overtime": expenses["overtime"],
                "total_expenses": total_expenses,
                "balance": balance,
                "has_data": (
                    daily["cash_sales"] != ZERO
                    or total_expenses != ZERO
                ),
            }
        )

    total_expenses = (
        total_general
        + total_utility
        + total_other
        + total_salary
        + total_overtime
    )

    cash_balance = (
        total_cash_sales - total_expenses
    )

    closing = await get_monthly_closing(
        session,
        business_id,
        year,
        month,
    )

    return {
        "year": year,
        "month": month,
        "month_name": get_month_name(month),
        "days_available": len(days),
        "total_cash_sales": total_cash_sales.quantize(
            Decimal("0.01")
        ),
        "total_general_expenses": total_general.quantize(
            Decimal("0.01")
        ),
        "total_utility_expenses": total_utility.quantize(
            Decimal("0.01")
        ),
        "total_other_expenses": total_other.quantize(
            Decimal("0.01")
        ),
        "total_employee_salary": total_salary.quantize(
            Decimal("0.01")
        ),
        "total_overtime": total_overtime.quantize(
            Decimal("0.01")
        ),
        "total_expenses": total_expenses.quantize(
            Decimal("0.01")
        ),
        "cash_balance": cash_balance.quantize(
            Decimal("0.01")
        ),
        "is_closed": (
            closing.is_closed
            if closing
            else False
        ),
        "days": daily_reports,
    }


async def get_year_report(
    session: AsyncSession,
    business_id: uuid.UUID,
    year: int,
    today: date | None = None,
) -> dict:
    if today is None:
        today = datetime.now(UTC).date()

    months = []

    for month in range(1, 13):
        first_day = date(year, month, 1)

        if first_day > today:
            break

        days = get_available_days(
            year,
            month,
            today,
        )

        closing = await get_monthly_closing(
            session,
            business_id,
            year,
            month,
        )

        months.append(
            {
                "year": year,
                "month": month,
                "name": get_month_name(month),
                "days_available": len(days),
                "is_current": (
                    year == today.year
                    and month == today.month
                ),
                "is_closed": (
                    closing.is_closed
                    if closing
                    else False
                ),
            }
        )

    return {
        "year": year,
        "months": months,
    }


async def get_monthly_closing(
    session: AsyncSession,
    business_id: uuid.UUID,
    year: int,
    month: int,
) -> MonthlyReportClosing | None:
    result = await session.execute(
        select(MonthlyReportClosing).where(
            MonthlyReportClosing.business_id == business_id,
            MonthlyReportClosing.year == year,
            MonthlyReportClosing.month == month,
        )
    )

    return result.scalar_one_or_none()


async def create_monthly_closing(
    session: AsyncSession,
    business_id: uuid.UUID,
    year: int,
    month: int,
    bank_balance: Decimal,
    closing_expense: Decimal,
) -> MonthlyReportClosing:
    existing = await get_monthly_closing(
        session,
        business_id,
        year,
        month,
    )

    if existing is not None:
        raise ValueError(
            "Monthly report is already closed"
        )

    closing = MonthlyReportClosing(
        business_id=business_id,
        year=year,
        month=month,
        bank_balance=bank_balance,
        closing_expense=closing_expense,
        is_closed=True,
        closed_at=datetime.now(UTC),
    )

    session.add(closing)

    await session.commit()
    await session.refresh(closing)

    return closing


async def update_monthly_closing(
    session: AsyncSession,
    closing: MonthlyReportClosing,
    bank_balance: Decimal | None = None,
    closing_expense: Decimal | None = None,
) -> MonthlyReportClosing:
    if bank_balance is not None:
        closing.bank_balance = bank_balance

    if closing_expense is not None:
        closing.closing_expense = closing_expense

    await session.commit()
    await session.refresh(closing)

    return closing