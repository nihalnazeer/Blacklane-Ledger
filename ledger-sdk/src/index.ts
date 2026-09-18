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
  EmployeeShift,
  EmployeeAttendanceStatus,
  EmployeeFinancialEventType,
  Employee,
  EmployeeCreate,
  EmployeeUpdate,
  EmployeeSalaryHistory,

  // Employee Daily Records
  EmployeeDailyRecord,
  EmployeeDailyRecordCreate,
  EmployeeDailyRecordUpdate,

  // Employee Financial Events
  EmployeeFinancialEvent,
  EmployeeFinancialEventCreate,
  EmployeeFinancialEventUpdate,

  // Employee Notes
  EmployeeNote,
  EmployeeNoteCreate,
  EmployeeNoteUpdate,

  // Employee Balance / Calendar / Ledger
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
  DailyClosingCreate,
  DailyClosing,
  MonthlyClosingCreate,
  MonthlyClosingUpdate,
  MonthlyClosing,

  // Dashboard
  Dashboard,
  DashboardToday,
  DashboardMonthToDate,
  DashboardAverages,
  DashboardEmployees,
  DashboardMonthStatus,

  // Authentication
  User,
  LoginRequest,
  SignupRequest,
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