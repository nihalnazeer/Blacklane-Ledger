export type UserRole = "admin" | "user";

export type BusinessMemberRole = "owner" | "member";

export type BusinessType = "restaurant";

/* -------------------------------------------------------------------------- */
/* Expenses                                                                   */
/* -------------------------------------------------------------------------- */

export type ExpenseType = "general" | "utility" | "other";

/* -------------------------------------------------------------------------- */
/* Employees                                                                  */
/* -------------------------------------------------------------------------- */

export type PaymentMethod = "daily" | "monthly";

export type EmployeeFinancialEventType =
  | "advance"
  | "overtime"
  | "leave_no_salary"
  | "payment"
  | "debt_offset";

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

export interface User {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

export interface RefreshRequest {
  refresh_token: string;
}

export type CurrentUserResponse = User;

export interface UserCreate {
  email: string;
  password: string;
  role?: UserRole;
}

/* -------------------------------------------------------------------------- */
/* Businesses                                                                 */
/* -------------------------------------------------------------------------- */

export interface BusinessCreate {
  name: string;
  business_type: BusinessType;
}

export interface Business {
  id: string;
  name: string;
  business_type: BusinessType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/* Sales                                                                      */
/* -------------------------------------------------------------------------- */

export interface Sale {
  id: string;
  business_id: string;
  sale_date: string;
  cash_income: string;
  bank_balance: string;
  created_at: string;
  updated_at: string;
}

export interface SaleCreate {
  sale_date: string;
  cash_income: string;
  bank_balance: string;
}

export interface SaleUpdate {
  sale_date?: string;
  cash_income?: string;
  bank_balance?: string;
}

/* -------------------------------------------------------------------------- */
/* Expenses                                                                   */
/* -------------------------------------------------------------------------- */

export interface Expense {
  id: string;
  business_id: string;
  expense_date: string;
  amount: string;
  description: string;
  expense_type: ExpenseType;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCreate {
  expense_date: string;
  amount: string;
  description: string;
  expense_type?: ExpenseType;
  note?: string | null;
}

export interface ExpenseUpdate {
  expense_date?: string;
  amount?: string;
  description?: string;
  expense_type?: ExpenseType;
  note?: string | null;
}

export interface DailyExpenseTotal {
  business_id: string;
  expense_date: string;
  total: string;
}

export interface MonthlyExpenseTotal {
  business_id: string;
  year: number;
  month: number;
  total: string;
}

/* -------------------------------------------------------------------------- */
/* Employees                                                                  */
/* -------------------------------------------------------------------------- */

export interface Employee {
  id: string;
  business_id: string;
  name: string;
  daily_salary: string;
  payment_method: PaymentMethod;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeCreate {
  name: string;
  daily_salary: string;
  payment_method?: PaymentMethod;
}

export interface EmployeeUpdate {
  name?: string;
  daily_salary?: string;
  payment_method?: PaymentMethod;
  is_active?: boolean;
  salary_effective_from?: string;
}

export interface EmployeeSalaryHistory {
  id: string;
  employee_id: string;
  effective_from: string;
  daily_salary: string;
  payment_method: PaymentMethod;
  created_at: string;
}

export interface EmployeeFinancialEvent {
  id: string;
  employee_id: string;
  event_date: string;
  event_type: EmployeeFinancialEventType;
  amount: string;
  description: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeFinancialEventCreate {
  event_date: string;
  event_type: EmployeeFinancialEventType;
  amount: string;
  description: string;
  note?: string | null;
}

export interface EmployeeFinancialEventUpdate {
  event_date?: string;
  event_type?: EmployeeFinancialEventType;
  amount?: string;
  description?: string;
  note?: string | null;
}

export interface EmployeeNote {
  id: string;
  employee_id: string;
  note_date: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeNoteCreate {
  note_date: string;
  title: string;
  content: string;
}

export interface EmployeeNoteUpdate {
  note_date?: string;
  title?: string;
  content?: string;
}

export interface EmployeeBalance {
  employee_id: string;
  balance: string;
}

export interface EmployeeDailySummary {
  date: string;
  salary_earned: string;
  overtime: string;
  leave_no_salary: string;
  payments: string;
  advances: string;
  debt_offsets: string;
  balance: string;
  has_events: boolean;
}

export interface EmployeeCalendar {
  employee: Employee;
  month: string;
  days: EmployeeDailySummary[];
}

export interface EmployeeLedger {
  employee: Employee;
  date: string;
  daily_salary: string;
  salary_earned: string;
  overtime: string;
  leave_no_salary: string;
  payments: string;
  advances: string;
  debt_offsets: string;
  balance: string;
  events: EmployeeFinancialEvent[];
  notes: EmployeeNote[];
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                    */
/* -------------------------------------------------------------------------- */

export interface ReportMonth {
  year: number;
  month: number;
  name: string;
  days_available: number;
  is_current: boolean;
  is_closed: boolean;
}

export interface ReportYear {
  year: number;
  months: ReportMonth[];
}

export interface ReportDailySummary {
  date: string;
  cash_sales: string;

  general_expenses: string;
  utility_expenses: string;
  other_expenses: string;

  employee_salary: string;
  overtime: string;

  total_expenses: string;
  balance: string;

  has_data: boolean;
}

export interface ReportMonthly {
  year: number;
  month: number;
  month_name: string;

  days_available: number;

  total_cash_sales: string;
  total_general_expenses: string;
  total_utility_expenses: string;
  total_other_expenses: string;
  total_employee_salary: string;
  total_overtime: string;
  total_expenses: string;
  cash_balance: string;

  is_closed: boolean;

  days: ReportDailySummary[];
}

export interface ReportDailyExpenseBreakdown {
  general: string;
  utility: string;
  other: string;
  employee_salary: string;
  overtime: string;
  total: string;
}

export interface ReportDaily {
  date: string;
  cash_sales: string;
  expenses: ReportDailyExpenseBreakdown;
  balance: string;
}

export interface MonthlyClosingCreate {
  bank_balance: string;
  closing_expense: string;
}

export interface MonthlyClosingUpdate {
  bank_balance?: string;
  closing_expense?: string;
}

export interface MonthlyClosing {
  id: string;
  business_id: string;
  year: number;
  month: number;

  cash_balance: string;
  bank_balance: string;
  total_balance: string;

  closing_expense: string;
  pnl: string;

  is_closed: boolean;
  closed_at: string | null;
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export interface DashboardToday {
  date: string;

  cash_sales: string;
  total_expenses: string;
  employee_salary: string;
  overtime: string;
  balance: string;

  has_data: boolean;
}

export interface DashboardMonthToDate {
  year: number;
  month: number;
  month_name: string;

  cash_sales: string;
  total_expenses: string;
  employee_salary: string;
  overtime: string;
  balance: string;
}

export interface DashboardEmployees {
  count: number;
}

export interface DashboardMonthStatus {
  is_closed: boolean;
}

export interface Dashboard {
  date: string;

  today: DashboardToday;
  month_to_date: DashboardMonthToDate;
  employees: DashboardEmployees;
  month_status: DashboardMonthStatus;
}