import calendar
import hashlib
import json
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.domains.businesses.models import (
    Business,
    BusinessMember,
    BusinessType,
)
from ledger.domains.employees.models import (
    Employee,
    EmployeeAttendanceStatus,
    EmployeeDailyRecord,
    EmployeeShift,
)
from ledger.domains.expenses.models import Expense, ExpenseType
from ledger.domains.reports.models import (
    DailyReportClosing,
    MonthlyReportClosing,
)
from ledger.domains.sales.models import Sale


ZERO = Decimal("0.00")


# Blacklane Ledger currently operates on Malaysia business time.
#
# This is the BUSINESS/ACCOUNTING timezone, not the timezone of the
# person using the browser.
#
# For now the restaurant business is in Malaysia, so reports use
# Asia/Kuala_Lumpur when the backend needs to determine "today".
#
# User/browser timezone should remain a frontend/UI concern.
REPORT_TIMEZONE = ZoneInfo("Asia/Kuala_Lumpur")


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


def get_report_today() -> date:
    """
    Return the current accounting date in the business timezone.

    The backend runs on infrastructure that may use UTC, so reports
    should not use datetime.now().date() for business-day logic.

    The business currently operates in Malaysia, so the accounting
    timezone is Asia/Kuala_Lumpur.

    This is intentionally separate from the user's/browser timezone.
    """

    return datetime.now(REPORT_TIMEZONE).date()


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
    """
    Calculate employee salary and overtime for a report date.

    EmployeeDailyRecord is the source of truth for the current employee
    attendance/accounting workflow.

    EmployeeDailyRecord contains:
        - salary_amount
        - overtime
        - salary_cut
        - status
        - shift

    EmployeeDailyRecord.record_date stores the WORK/SELECTED DATE stored by
    the employee workflow.

    The shift determines which accounting/report date the record belongs to:

        DAY:
            work date D -> report/accounting date D

        NIGHT:
            work date D -> report/accounting date D + 1

    Therefore a report for target_date must include:
        - DAY records stored on target_date
        - NIGHT records stored on target_date - 1 day

    The report must not derive dates from the user's/browser timezone or
    from the time the record was entered.

    Both a DAY and NIGHT record may legitimately contribute to the same
    employee accounting date, so both are included when applicable.

    A missing EmployeeDailyRecord means that attendance has not been
    recorded for that employee on the relevant accounting date. In that
    case, no salary is earned and no salary is added automatically from
    the employee's configured salary rate.

    Returns:
        (
            employee_salary,
            overtime,
        )

    employee_salary is the base salary after salary cuts.
    overtime is reported separately.
    """

    employee_result = await session.execute(
        select(Employee).where(
            Employee.business_id == business_id,
            Employee.accounting_start_date <= target_date,
        )
    )

    employees = list(
        employee_result.scalars().all()
    )

    if not employees:
        return ZERO, ZERO

    employee_ids = [employee.id for employee in employees]

    # EmployeeDailyRecord.record_date stores the selected/work date.
    #
    # DAY belongs to the same accounting/report date.
    # NIGHT belongs to the following accounting/report date.
    #
    # So, for report date D:
    #   DAY   -> record_date D
    #   NIGHT -> record_date D - 1 day
    #
    # This keeps the existing stored employee records intact while making
    # the reporting attribution match the employee workflow.
    previous_date = target_date - timedelta(days=1)

    daily_records_result = await session.execute(
        select(EmployeeDailyRecord).where(
            EmployeeDailyRecord.employee_id.in_(employee_ids),
            or_(
                and_(
                    EmployeeDailyRecord.record_date == target_date,
                    EmployeeDailyRecord.shift == EmployeeShift.DAY.value,
                ),
                and_(
                    EmployeeDailyRecord.record_date == previous_date,
                    EmployeeDailyRecord.shift == EmployeeShift.NIGHT.value,
                ),
            ),
        )
    )

    daily_records = list(
        daily_records_result.scalars().all()
    )

    records_by_employee: dict[
        uuid.UUID,
        list[EmployeeDailyRecord],
    ] = {}

    for record in daily_records:
        records_by_employee.setdefault(
            record.employee_id,
            [],
        ).append(record)

    salary_total = ZERO
    overtime_total = ZERO

    for employee in employees:
        employee_records = records_by_employee.get(
            employee.id,
            [],
        )

        # EmployeeDailyRecord is authoritative whenever at least one
        # attendance record exists for this employee/accounting date.
        #
        # This is important because an explicit LEAVE record or a
        # PRESENT record with zero salary is still a real accounting
        # record. We must not treat a zero resulting amount as missing
        # attendance.
        if employee_records:
            for record in employee_records:
                # Leave means no salary and no overtime for this
                # particular shift record.
                if (
                    record.status
                    == EmployeeAttendanceStatus.LEAVE.value
                ):
                    continue

                salary_amount = (
                    record.salary_amount
                    if record.salary_amount is not None
                    else ZERO
                )

                salary_cut = (
                    record.salary_cut
                    if record.salary_cut is not None
                    else ZERO
                )

                overtime = (
                    record.overtime
                    if record.overtime is not None
                    else ZERO
                )

                salary_total += (
                    salary_amount - salary_cut
                )

                overtime_total += overtime

            # Do not apply any automatic salary calculation after
            # processing the attendance records.
            continue

        # No daily attendance record means that attendance has not been
        # recorded for this employee on this accounting date.
        #
        # The employee's configured daily salary is only a salary RATE.
        # It must not be treated as earned salary automatically.
        #
        # Therefore:
        #   no EmployeeDailyRecord -> no salary earned
        #
        # This keeps Reports aligned with the attendance-driven employee
        # accounting workflow.
        continue

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
            ].quantize(
                Decimal("0.01")
            ),
            "utility": expense_breakdown[
                ExpenseType.UTILITY.value
            ].quantize(
                Decimal("0.01")
            ),
            "other": expense_breakdown[
                ExpenseType.OTHER.value
            ].quantize(
                Decimal("0.01")
            ),
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


async def get_daily_closing(
    session: AsyncSession,
    business_id: uuid.UUID,
    report_date: date,
) -> DailyReportClosing | None:
    result = await session.execute(
        select(DailyReportClosing).where(
            DailyReportClosing.business_id == business_id,
            DailyReportClosing.report_date == report_date,
        )
    )

    return result.scalar_one_or_none()


async def get_daily_accounting_fingerprint(
    session: AsyncSession,
    business_id: uuid.UUID,
    report_date: date,
) -> str:
    report = await get_daily_report(
        session,
        business_id,
        report_date,
    )

    payload = {
        "date": report["date"].isoformat(),
        "cash_sales": str(report["cash_sales"]),
        "expenses": {
            "general": str(report["expenses"]["general"]),
            "utility": str(report["expenses"]["utility"]),
            "other": str(report["expenses"]["other"]),
            "employee_salary": str(report["expenses"]["employee_salary"]),
            "overtime": str(report["expenses"]["overtime"]),
            "total": str(report["expenses"]["total"]),
        },
        "balance": str(report["balance"]),
    }

    serialized = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")

    return hashlib.sha256(serialized).hexdigest()


async def create_or_reclose_daily_closing(
    session: AsyncSession,
    business_id: uuid.UUID,
    report_date: date,
    note: str | None,
) -> DailyReportClosing:
    fingerprint = await get_daily_accounting_fingerprint(
        session,
        business_id,
        report_date,
    )

    closing = await get_daily_closing(
        session,
        business_id,
        report_date,
    )

    now = datetime.now(REPORT_TIMEZONE)

    if closing is None:
        closing = DailyReportClosing(
            business_id=business_id,
            report_date=report_date,
            accounting_fingerprint=fingerprint,
            note=note,
            is_closed=True,
            closed_at=now,
        )
        session.add(closing)
    else:
        closing.accounting_fingerprint = fingerprint
        closing.note = note
        closing.is_closed = True
        closing.closed_at = now

    await session.commit()
    await session.refresh(closing)

    return closing


async def get_monthly_report(
    session: AsyncSession,
    business_id: uuid.UUID,
    year: int,
    month: int,
    today: date | None = None,
) -> dict:
    if today is None:
        today = get_report_today()

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
        today = get_report_today()

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
        closed_at=datetime.now(REPORT_TIMEZONE),
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