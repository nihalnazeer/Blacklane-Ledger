from fastapi import APIRouter

from ledger.api.v1.health import router as health_router
from ledger.domains.auth.router import router as auth_router
from ledger.domains.businesses.router import router as businesses_router
from ledger.domains.employees.router import router as employees_router
from ledger.domains.expenses.router import router as expenses_router
from ledger.domains.reports.router import router as reports_router
from ledger.domains.sales.router import router as sales_router
from ledger.domains.users.router import router as users_router
from ledger.domains.dashboard.router import router as dashboard_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(businesses_router)
api_router.include_router(sales_router)
api_router.include_router(expenses_router)
api_router.include_router(employees_router)
api_router.include_router(reports_router)
api_router.include_router(dashboard_router)