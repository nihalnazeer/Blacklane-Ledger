from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class DashboardToday(BaseModel):
    date: date

    cash_sales: Decimal
    total_expenses: Decimal
    employee_salary: Decimal
    overtime: Decimal
    balance: Decimal

    has_data: bool


class DashboardMonthToDate(BaseModel):
    year: int
    month: int
    month_name: str

    cash_sales: Decimal
    total_expenses: Decimal
    employee_salary: Decimal
    overtime: Decimal
    balance: Decimal


class DashboardEmployees(BaseModel):
    count: int


class DashboardMonthStatus(BaseModel):
    is_closed: bool


class DashboardResponse(BaseModel):
    date: date

    today: DashboardToday
    month_to_date: DashboardMonthToDate
    employees: DashboardEmployees
    month_status: DashboardMonthStatus