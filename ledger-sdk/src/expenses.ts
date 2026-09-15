import { ApiClient } from "./client";
import type {
  DailyExpenseTotal,
  Expense,
  ExpenseCreate,
  ExpenseUpdate,
  MonthlyExpenseTotal,
} from "./types";

export class ExpensesApi {
  constructor(private readonly client: ApiClient) {}

  list(
    businessId: string,
    expenseDate?: string,
  ): Promise<Expense[]> {
    const params = expenseDate
      ? `?expense_date=${encodeURIComponent(expenseDate)}`
      : "";

    return this.client.get<Expense[]>(
      `/api/v1/businesses/${businessId}/expenses${params}`,
    );
  }

  get(
    businessId: string,
    expenseId: string,
  ): Promise<Expense> {
    return this.client.get<Expense>(
      `/api/v1/businesses/${businessId}/expenses/${expenseId}`,
    );
  }

  create(
    businessId: string,
    data: ExpenseCreate,
  ): Promise<Expense> {
    return this.client.post<Expense>(
      `/api/v1/businesses/${businessId}/expenses`,
      data,
    );
  }

  update(
    businessId: string,
    expenseId: string,
    data: ExpenseUpdate,
  ): Promise<Expense> {
    return this.client.patch<Expense>(
      `/api/v1/businesses/${businessId}/expenses/${expenseId}`,
      data,
    );
  }

  delete(
    businessId: string,
    expenseId: string,
  ): Promise<void> {
    return this.client.delete<void>(
      `/api/v1/businesses/${businessId}/expenses/${expenseId}`,
    );
  }

  dailyTotal(
    businessId: string,
    expenseDate: string,
  ): Promise<DailyExpenseTotal> {
    return this.client.get<DailyExpenseTotal>(
      `/api/v1/businesses/${businessId}/expenses/daily-total?expense_date=${encodeURIComponent(
        expenseDate,
      )}`,
    );
  }

  monthlyTotal(
    businessId: string,
    year: number,
    month: number,
  ): Promise<MonthlyExpenseTotal> {
    return this.client.get<MonthlyExpenseTotal>(
      `/api/v1/businesses/${businessId}/expenses/monthly-total?year=${year}&month=${month}`,
    );
  }
}