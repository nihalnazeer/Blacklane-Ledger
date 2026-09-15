import { ApiClient } from "./client";

import { AuthApi } from "./auth";

import { BusinessesApi } from "./businesses";

import { DashboardApi } from "./dashboard";

import { EmployeesApi } from "./employees";

import { ExpensesApi } from "./expenses";

import { ReportsApi } from "./reports";

import { SalesApi } from "./sales";

import { UsersApi } from "./users";

export interface LedgerSdkOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
}

export class LedgerSdk {
  readonly auth: AuthApi;

  readonly businesses: BusinessesApi;

  readonly dashboard: DashboardApi;

  readonly employees: EmployeesApi;

  readonly expenses: ExpensesApi;

  readonly reports: ReportsApi;

  readonly sales: SalesApi;

  readonly users: UsersApi;

  constructor(options: LedgerSdkOptions) {
    const client = new ApiClient(options);

    this.auth = new AuthApi(client);

    this.businesses = new BusinessesApi(client);

    this.dashboard = new DashboardApi(client);

    this.employees = new EmployeesApi(client);

    this.expenses = new ExpensesApi(client);

    this.reports = new ReportsApi(client);

    this.sales = new SalesApi(client);

    this.users = new UsersApi(client);
  }
}