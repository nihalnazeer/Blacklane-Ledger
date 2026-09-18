import { ApiClient } from "./client";
import type {
  DailyClosing,
  DailyClosingCreate,
  MonthlyClosing,
  MonthlyClosingCreate,
  MonthlyClosingUpdate,
  ReportDaily,
  ReportMonthly,
  ReportYear,
} from "./types";

export class ReportsApi {
  constructor(private readonly client: ApiClient) {}

  year(
    businessId: string,
    year: number,
  ): Promise<ReportYear> {
    return this.client.get<ReportYear>(
      `/api/v1/businesses/${businessId}/reports/year?year=${year}`,
    );
  }

  monthly(
    businessId: string,
    year: number,
    month: number,
  ): Promise<ReportMonthly> {
    return this.client.get<ReportMonthly>(
      `/api/v1/businesses/${businessId}/reports/monthly?year=${year}&month=${month}`,
    );
  }

  daily(
    businessId: string,
    reportDate: string,
  ): Promise<ReportDaily> {
    return this.client.get<ReportDaily>(
      `/api/v1/businesses/${businessId}/reports/daily?report_date=${encodeURIComponent(
        reportDate,
      )}`,
    );
  }

  getDailyClosing(
    businessId: string,
    reportDate: string,
  ): Promise<DailyClosing> {
    return this.client.get<DailyClosing>(
      `/api/v1/businesses/${businessId}/reports/daily/${encodeURIComponent(
        reportDate,
      )}/closing`,
    );
  }

  closeDay(
    businessId: string,
    reportDate: string,
    data: DailyClosingCreate,
  ): Promise<DailyClosing> {
    return this.client.post<DailyClosing>(
      `/api/v1/businesses/${businessId}/reports/daily/${encodeURIComponent(
        reportDate,
      )}/closing`,
      data,
    );
  }

  getClosing(
    businessId: string,
    year: number,
    month: number,
  ): Promise<MonthlyClosing> {
    return this.client.get<MonthlyClosing>(
      `/api/v1/businesses/${businessId}/reports/monthly/${year}/${month}/closing`,
    );
  }

  closeMonth(
    businessId: string,
    year: number,
    month: number,
    data: MonthlyClosingCreate,
  ): Promise<MonthlyClosing> {
    return this.client.post<MonthlyClosing>(
      `/api/v1/businesses/${businessId}/reports/monthly/${year}/${month}/closing`,
      data,
    );
  }

  updateClosing(
    businessId: string,
    year: number,
    month: number,
    data: MonthlyClosingUpdate,
  ): Promise<MonthlyClosing> {
    return this.client.patch<MonthlyClosing>(
      `/api/v1/businesses/${businessId}/reports/monthly/${year}/${month}/closing`,
      data,
    );
  }
}
