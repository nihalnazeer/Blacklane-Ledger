import { ApiClient } from "./client";
import type {
  Employee,
  EmployeeBalance,
  EmployeeCalendar,
  EmployeeCreate,
  EmployeeDailyRecord,
  EmployeeDailyRecordCreate,
  EmployeeDailyRecordUpdate,
  EmployeeFinancialEvent,
  EmployeeFinancialEventCreate,
  EmployeeFinancialEventUpdate,
  EmployeeLedger,
  EmployeeNote,
  EmployeeNoteCreate,
  EmployeeNoteUpdate,
  EmployeeSalaryHistory,
  EmployeeUpdate,
} from "./types";

export class EmployeesApi {
  constructor(private readonly client: ApiClient) {}

  // ---------------------------------------------------------------------------
  // Employees
  // ---------------------------------------------------------------------------

  list(businessId: string): Promise<Employee[]> {
    return this.client.get<Employee[]>(
      `/api/v1/businesses/${businessId}/employees`,
    );
  }

  get(
    businessId: string,
    employeeId: string,
  ): Promise<Employee> {
    return this.client.get<Employee>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}`,
    );
  }

  create(
    businessId: string,
    data: EmployeeCreate,
  ): Promise<Employee> {
    return this.client.post<Employee>(
      `/api/v1/businesses/${businessId}/employees`,
      data,
    );
  }

  update(
    businessId: string,
    employeeId: string,
    data: EmployeeUpdate,
  ): Promise<Employee> {
    return this.client.patch<Employee>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}`,
      data,
    );
  }

  delete(
    businessId: string,
    employeeId: string,
  ): Promise<void> {
    return this.client.delete<void>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Balance
  // ---------------------------------------------------------------------------

  balance(
    businessId: string,
    employeeId: string,
  ): Promise<EmployeeBalance> {
    return this.client.get<EmployeeBalance>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/balance`,
    );
  }

  // ---------------------------------------------------------------------------
  // Calendar
  // ---------------------------------------------------------------------------

  calendar(
    businessId: string,
    employeeId: string,
    year: number,
    month: number,
  ): Promise<EmployeeCalendar> {
    return this.client.get<EmployeeCalendar>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/calendar?year=${year}&month=${month}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Ledger / date detail
  // ---------------------------------------------------------------------------

  ledger(
    businessId: string,
    employeeId: string,
    date: string,
  ): Promise<EmployeeLedger> {
    return this.client.get<EmployeeLedger>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/ledger?date=${encodeURIComponent(
        date,
      )}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Salary history
  // ---------------------------------------------------------------------------

  listSalaryHistory(
    businessId: string,
    employeeId: string,
  ): Promise<EmployeeSalaryHistory[]> {
    return this.client.get<EmployeeSalaryHistory[]>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/salary-history`,
    );
  }

  // ---------------------------------------------------------------------------
  // Daily employee records
  // ---------------------------------------------------------------------------

  listDailyRecords(
    businessId: string,
    employeeId: string,
    recordDate?: string,
  ): Promise<EmployeeDailyRecord[]> {
    const query = recordDate
      ? `?date=${encodeURIComponent(recordDate)}`
      : "";

    return this.client.get<EmployeeDailyRecord[]>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/daily-records${query}`,
    );
  }

  getDailyRecord(
    businessId: string,
    employeeId: string,
    recordId: string,
  ): Promise<EmployeeDailyRecord> {
    return this.client.get<EmployeeDailyRecord>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/daily-records/${recordId}`,
    );
  }

  createDailyRecord(
    businessId: string,
    employeeId: string,
    data: EmployeeDailyRecordCreate,
  ): Promise<EmployeeDailyRecord> {
    return this.client.post<EmployeeDailyRecord>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/daily-records`,
      data,
    );
  }

  updateDailyRecord(
    businessId: string,
    employeeId: string,
    recordId: string,
    data: EmployeeDailyRecordUpdate,
  ): Promise<EmployeeDailyRecord> {
    return this.client.patch<EmployeeDailyRecord>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/daily-records/${recordId}`,
      data,
    );
  }

  deleteDailyRecord(
    businessId: string,
    employeeId: string,
    recordId: string,
  ): Promise<void> {
    return this.client.delete<void>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/daily-records/${recordId}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Financial events
  // ---------------------------------------------------------------------------

  listEvents(
    businessId: string,
    employeeId: string,
  ): Promise<EmployeeFinancialEvent[]> {
    return this.client.get<EmployeeFinancialEvent[]>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/financial-events`,
    );
  }

  getEvent(
    businessId: string,
    employeeId: string,
    eventId: string,
  ): Promise<EmployeeFinancialEvent> {
    return this.client.get<EmployeeFinancialEvent>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/financial-events/${eventId}`,
    );
  }

  createEvent(
    businessId: string,
    employeeId: string,
    data: EmployeeFinancialEventCreate,
  ): Promise<EmployeeFinancialEvent> {
    return this.client.post<EmployeeFinancialEvent>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/financial-events`,
      data,
    );
  }

  updateEvent(
    businessId: string,
    employeeId: string,
    eventId: string,
    data: EmployeeFinancialEventUpdate,
  ): Promise<EmployeeFinancialEvent> {
    return this.client.patch<EmployeeFinancialEvent>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/financial-events/${eventId}`,
      data,
    );
  }

  deleteEvent(
    businessId: string,
    employeeId: string,
    eventId: string,
  ): Promise<void> {
    return this.client.delete<void>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/financial-events/${eventId}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Notes
  // ---------------------------------------------------------------------------

  listNotes(
    businessId: string,
    employeeId: string,
  ): Promise<EmployeeNote[]> {
    return this.client.get<EmployeeNote[]>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/notes`,
    );
  }

  getNote(
    businessId: string,
    employeeId: string,
    noteId: string,
  ): Promise<EmployeeNote> {
    return this.client.get<EmployeeNote>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/notes/${noteId}`,
    );
  }

  createNote(
    businessId: string,
    employeeId: string,
    data: EmployeeNoteCreate,
  ): Promise<EmployeeNote> {
    return this.client.post<EmployeeNote>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/notes`,
      data,
    );
  }

  updateNote(
    businessId: string,
    employeeId: string,
    noteId: string,
    data: EmployeeNoteUpdate,
  ): Promise<EmployeeNote> {
    return this.client.patch<EmployeeNote>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/notes/${noteId}`,
      data,
    );
  }

  deleteNote(
    businessId: string,
    employeeId: string,
    noteId: string,
  ): Promise<void> {
    return this.client.delete<void>(
      `/api/v1/businesses/${businessId}/employees/${employeeId}/notes/${noteId}`,
    );
  }
}