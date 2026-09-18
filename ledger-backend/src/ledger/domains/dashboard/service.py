import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.domains.businesses.models import (
    Business,
    BusinessMember,
    BusinessType,
)
from ledger.domains.employees.models import Employee
from ledger.domains.reports.service import get_monthly_report


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


async def get_active_employee_count(
    session: AsyncSession,
    business_id: uuid.UUID,
) -> int:
    result = await session.execute(
        select(func.count(Employee.id)).where(
            Employee.business_id == business_id,
            Employee.is_active.is_(True),
        )
    )

    return int(result.scalar_one() or 0)


async def get_dashboard(
    session: AsyncSession,
    business_id: uuid.UUID,
    target_date: date | None = None,
) -> dict:
    if target_date is None:
        target_date = date.today()

    monthly_report = await get_monthly_report(
        session,
        business_id,
        target_date.year,
        target_date.month,
    )

    today_summary = next(
        (
            day
            for day in monthly_report["days"]
            if day["date"] == target_date
        ),
        None,
    )

    if today_summary is None:
        today_summary = {
            "date": target_date,
            "cash_sales": ZERO,
            "total_expenses": ZERO,
            "employee_salary": ZERO,
            "overtime": ZERO,
            "balance": ZERO,
            "has_data": False,
        }

    employee_count = await get_active_employee_count(
        session,
        business_id,
    )

    elapsed_days = target_date.day

    cash_sales_average = (
        monthly_report["total_cash_sales"] / elapsed_days
        if elapsed_days > 0
        else ZERO
    )

    expenses_average = (
        monthly_report["total_expenses"] / elapsed_days
        if elapsed_days > 0
        else ZERO
    )

    employee_salary_average = (
        monthly_report["total_employee_salary"] / elapsed_days
        if elapsed_days > 0
        else ZERO
    )

    overtime_average = (
        monthly_report["total_overtime"] / elapsed_days
        if elapsed_days > 0
        else ZERO
    )

    balance_average = (
        monthly_report["cash_balance"] / elapsed_days
        if elapsed_days > 0
        else ZERO
    )

    return {
        "date": target_date,
        "today": {
            "date": today_summary["date"],
            "cash_sales": today_summary["cash_sales"],
            "total_expenses": today_summary["total_expenses"],
            "employee_salary": today_summary["employee_salary"],
            "overtime": today_summary["overtime"],
            "balance": today_summary["balance"],
            "has_data": today_summary["has_data"],
        },
        "month_to_date": {
            "year": monthly_report["year"],
            "month": monthly_report["month"],
            "month_name": monthly_report["month_name"],
            "cash_sales": monthly_report["total_cash_sales"],
            "total_expenses": monthly_report["total_expenses"],
            "employee_salary": monthly_report["total_employee_salary"],
            "overtime": monthly_report["total_overtime"],
            "balance": monthly_report["cash_balance"],
        },
        "averages": {
            "cash_sales": cash_sales_average,
            "total_expenses": expenses_average,
            "employee_salary": employee_salary_average,
            "overtime": overtime_average,
            "balance": balance_average,
        },
        "employees": {
            "count": employee_count,
        },
        "month_status": {
            "is_closed": monthly_report["is_closed"],
        },
    }