export { ApiClient } from "./client";
export { LedgerSdk } from "./sdk";

export { AuthApi } from "./auth";
export { BusinessesApi } from "./businesses";
export { DashboardApi } from "./dashboard";
export { EmployeesApi } from "./employees";
export { ExpensesApi } from "./expenses";
export { ReportsApi } from "./reports";
export { SalesApi } from "./sales";
export { UsersApi } from "./users";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type {
  UserRole,
  BusinessMemberRole,
  BusinessType,

  // Expenses
  ExpenseType,
  Expense,
  ExpenseCreate,
  ExpenseUpdate,
  DailyExpenseTotal,
  MonthlyExpenseTotal,

  // Employees
  PaymentMethod,
  EmployeeFinancialEventType,
  Employee,
  EmployeeCreate,
  EmployeeUpdate,
  EmployeeSalaryHistory,
  EmployeeFinancialEvent,
  EmployeeFinancialEventCreate,
  EmployeeFinancialEventUpdate,
  EmployeeNote,
  EmployeeNoteCreate,
  EmployeeNoteUpdate,
  EmployeeBalance,
  EmployeeDailySummary,
  EmployeeCalendar,
  EmployeeLedger,

  // Reports
  ReportMonth,
  ReportYear,
  ReportDailySummary,
  ReportMonthly,
  ReportDailyExpenseBreakdown,
  ReportDaily,
  MonthlyClosingCreate,
  MonthlyClosingUpdate,
  MonthlyClosing,

  // Dashboard
  Dashboard,
  DashboardToday,
  DashboardMonthToDate,
  DashboardEmployees,
  DashboardMonthStatus,

  // Authentication
  User,
  LoginRequest,
  TokenResponse,
  RefreshRequest,
  CurrentUserResponse,
  UserCreate,

  // Businesses
  BusinessCreate,
  Business,

  // Sales
  Sale,
  SaleCreate,
  SaleUpdate,
} from "./types";