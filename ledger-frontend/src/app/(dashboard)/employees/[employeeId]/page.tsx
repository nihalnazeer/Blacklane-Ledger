
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import type {
  Employee,
  EmployeeBalance,
  EmployeeCalendar,
  EmployeeDailySummary,
  EmployeeFinancialEvent,
  EmployeeFinancialEventCreate,
  EmployeeFinancialEventType,
  EmployeeNote,
} from "@blacklane-ledger/sdk";

import { sdk } from "@/lib/api";

type EventFilter = "all" | EmployeeFinancialEventType;

const EVENT_TYPES: {
  value: EmployeeFinancialEventType;
  label: string;
}[] = [
  { value: "advance", label: "Advance" },
  { value: "overtime", label: "Overtime / Extra Salary" },
  { value: "leave_no_salary", label: "Leave — No Salary" },
  { value: "payment", label: "Payment" },
  { value: "debt_offset", label: "Debt Offset" },
];

const EVENT_TYPE_LABELS: Record<EmployeeFinancialEventType, string> = {
  advance: "Advance",
  overtime: "Overtime",
  leave_no_salary: "Leave — No Salary",
  payment: "Payment",
  debt_offset: "Debt Offset",
};

function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);

  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function formatMonth(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function getMonthName(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
  });
}

function getEventTypeLabel(type: EmployeeFinancialEventType): string {
  return EVENT_TYPE_LABELS[type] ?? type;
}

function getEventSign(type: EmployeeFinancialEventType): string {
  switch (type) {
    case "overtime":
      return "+";

    case "leave_no_salary":
      return "-";

    case "advance":
      return "-";

    case "payment":
      return "-";

    case "debt_offset":
      return "+";

    default:
      return "";
  }
}

function getBalanceLabel(balance: number): string {
  if (balance > 0) {
    return "Business owes employee";
  }

  if (balance < 0) {
    return "Employee owes business";
  }

  return "Settled";
}

function getBalanceClass(balance: number): string {
  if (balance > 0) {
    return "text-emerald-400";
  }

  if (balance < 0) {
    return "text-red-400";
  }

  return "text-zinc-300";
}

function getDayBalanceClass(balance: number): string {
  if (balance > 0) {
    return "text-emerald-400";
  }

  if (balance < 0) {
    return "text-red-400";
  }

  return "text-zinc-400";
}

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();

  const employeeId =
    typeof params.employeeId === "string" ? params.employeeId : null;

  const [businessId, setBusinessId] = useState<string | null>(null);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [balance, setBalance] = useState<EmployeeBalance | null>(null);
  const [calendar, setCalendar] = useState<EmployeeCalendar | null>(null);

  const [events, setEvents] = useState<EmployeeFinancialEvent[]>([]);
  const [notes, setNotes] = useState<EmployeeNote[]>([]);

  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);

  const todayString = useMemo(
    () => today.toISOString().slice(0, 10),
    [today],
  );

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

  const [selectedDay, setSelectedDay] =
    useState<EmployeeDailySummary | null>(null);

  const [eventFilter, setEventFilter] = useState<EventFilter>("all");

  const [showEventModal, setShowEventModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const [savingEvent, setSavingEvent] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const [eventType, setEventType] =
    useState<EmployeeFinancialEventType>("advance");

  const [eventDate, setEventDate] = useState(todayString);

  const [eventAmount, setEventAmount] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventNote, setEventNote] = useState("");

  const [noteDate, setNoteDate] = useState(todayString);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const loadEmployee = useCallback(async () => {
    if (!businessId || !employeeId) {
      return;
    }

    const currentBusinessId = businessId;
    const currentEmployeeId = employeeId;

    const [employeeResult, balanceResult, calendarResult] =
      await Promise.all([
        sdk.employees.get(currentBusinessId, currentEmployeeId),
        sdk.employees.balance(currentBusinessId, currentEmployeeId),
        sdk.employees.calendar(
          currentBusinessId,
          currentEmployeeId,
          selectedYear,
          selectedMonth,
        ),
      ]);

    setEmployee(employeeResult);
    setBalance(balanceResult);
    setCalendar(calendarResult);
  }, [businessId, employeeId, selectedYear, selectedMonth]);

  const loadActivity = useCallback(async () => {
    if (!businessId || !employeeId) {
      return;
    }

    const currentBusinessId = businessId;
    const currentEmployeeId = employeeId;

    setActivityLoading(true);

    try {
      /*
       * Load events and notes independently.
       *
       * Events use the SDK's financial-events endpoint:
       * /api/v1/businesses/{businessId}/employees/{employeeId}/financial-events
       *
       * Notes use:
       * /api/v1/businesses/{businessId}/employees/{employeeId}/notes
       *
       * Keeping these requests independent means one failed activity
       * endpoint does not prevent the other activity type from loading.
       */

      const [eventsResult, notesResult] = await Promise.allSettled([
        sdk.employees.listEvents(
          currentBusinessId,
          currentEmployeeId,
        ),
        sdk.employees.listNotes(
          currentBusinessId,
          currentEmployeeId,
        ),
      ]);

      if (eventsResult.status === "fulfilled") {
        setEvents(eventsResult.value);
      } else {
        console.error(
          "Failed to load employee financial events:",
          eventsResult.reason,
        );
      }

      if (notesResult.status === "fulfilled") {
        setNotes(notesResult.value);
      } else {
        console.error(
          "Failed to load employee notes:",
          notesResult.reason,
        );
      }
    } finally {
      setActivityLoading(false);
    }
  }, [businessId, employeeId]);

  useEffect(() => {
    const storedBusinessId = window.localStorage.getItem("business_id");

    if (!storedBusinessId) {
      router.replace("/businesses");
      return;
    }

    setBusinessId(storedBusinessId);
  }, [router]);

  useEffect(() => {
    if (!businessId || !employeeId) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        await loadEmployee();

        if (cancelled) {
          return;
        }

        await loadActivity();
      } catch (err) {
        console.error("Failed to load employee:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load employee",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    businessId,
    employeeId,
    selectedYear,
    selectedMonth,
    loadEmployee,
    loadActivity,
  ]);

  /*
   * Keep today's date selected by default whenever the current month's
   * calendar is loaded.
   *
   * For previous months, select the latest available day in that month.
   */
  useEffect(() => {
    if (!calendar?.days?.length) {
      return;
    }

    const sortedDays = [...calendar.days].sort((a, b) =>
      b.date.localeCompare(a.date),
    );

    const defaultDay =
      selectedYear === today.getFullYear() &&
      selectedMonth === today.getMonth() + 1
        ? sortedDays.find((day) => day.date === todayString) ??
          sortedDays[0]
        : sortedDays[0];

    setSelectedDay(defaultDay);
  }, [
    calendar,
    selectedYear,
    selectedMonth,
    today,
    todayString,
  ]);

  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((year) => year - 1);
      setSelectedMonth(12);
      return;
    }

    setSelectedMonth((month) => month - 1);
  };

  const goToNextMonth = () => {
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    if (
      selectedYear > currentYear ||
      (selectedYear === currentYear && selectedMonth >= currentMonth)
    ) {
      return;
    }

    if (selectedMonth === 12) {
      setSelectedYear((year) => year + 1);
      setSelectedMonth(1);
      return;
    }

    setSelectedMonth((month) => month + 1);
  };

  const isCurrentMonth =
    selectedYear === today.getFullYear() &&
    selectedMonth === today.getMonth() + 1;

  const canGoNext =
    !isCurrentMonth &&
    new Date(selectedYear, selectedMonth - 1, 1) <
      new Date(today.getFullYear(), today.getMonth(), 1);

  const filteredEvents = useMemo(() => {
    if (eventFilter === "all") {
      return events;
    }

    return events.filter(
      (event) => event.event_type === eventFilter,
    );
  }, [events, eventFilter]);

  const monthlySummary = useMemo(() => {
    if (!calendar?.days) {
      return {
        salary: 0,
        overtime: 0,
        payments: 0,
        advances: 0,
        balance: 0,
        workingDays: 0,
      };
    }

    return calendar.days.reduce(
      (summary, day) => {
        summary.salary += Number(day.salary_earned ?? 0);
        summary.overtime += Number(day.overtime ?? 0);
        summary.payments += Number(day.payments ?? 0);
        summary.advances += Number(day.advances ?? 0);
        summary.balance += Number(day.balance ?? 0);

        if (Number(day.salary_earned ?? 0) > 0) {
          summary.workingDays += 1;
        }

        return summary;
      },
      {
        salary: 0,
        overtime: 0,
        payments: 0,
        advances: 0,
        balance: 0,
        workingDays: 0,
      },
    );
  }, [calendar]);

  const openEventModal = (
    type?: EmployeeFinancialEventType,
  ) => {
    setEventType(type ?? "advance");

    setEventDate(
      selectedDay?.date ??
        todayString,
    );

    setEventAmount("");
    setEventDescription("");
    setEventNote("");
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    if (savingEvent) {
      return;
    }

    setShowEventModal(false);
  };

  const createEvent = async () => {
    if (!businessId || !employeeId) {
      return;
    }

    if (!eventDate) {
      return;
    }

    if (
      eventType !== "leave_no_salary" &&
      (!eventAmount || Number(eventAmount) <= 0)
    ) {
      return;
    }

    setSavingEvent(true);

    try {
      const data: EmployeeFinancialEventCreate = {
        event_date: eventDate,
        event_type: eventType,
        amount:
          eventType === "leave_no_salary"
            ? "0"
            : eventAmount,
        description:
          eventDescription.trim() ||
          getEventTypeLabel(eventType),
        note: eventNote.trim() || null,
      };

      await sdk.employees.createEvent(
        businessId,
        employeeId,
        data,
      );

      setShowEventModal(false);

      await Promise.all([
        loadEmployee(),
        loadActivity(),
      ]);

      if (selectedDay) {
        try {
          const updatedLedger =
            await sdk.employees.ledger(
              businessId,
              employeeId,
              selectedDay.date,
            );

          setSelectedDay({
            ...selectedDay,
            salary_earned: updatedLedger.salary_earned,
            overtime: updatedLedger.overtime,
            leave_no_salary:
              updatedLedger.leave_no_salary,
            payments: updatedLedger.payments,
            advances: updatedLedger.advances,
            debt_offsets:
              updatedLedger.debt_offsets,
            balance: updatedLedger.balance,
          });
        } catch (err) {
          console.error(
            "Failed to refresh selected day:",
            err,
          );
        }
      }
    } catch (err) {
      console.error(
        "Failed to create employee event:",
        err,
      );

      window.alert(
        err instanceof Error
          ? err.message
          : "Failed to create event",
      );
    } finally {
      setSavingEvent(false);
    }
  };

  const createNote = async () => {
    if (!businessId || !employeeId) {
      return;
    }

    if (!noteTitle.trim() || !noteContent.trim()) {
      return;
    }

    setSavingNote(true);

    try {
      await sdk.employees.createNote(
        businessId,
        employeeId,
        {
          note_date: noteDate,
          title: noteTitle.trim(),
          content: noteContent.trim(),
        },
      );

      setNoteTitle("");
      setNoteContent("");
      setShowNoteModal(false);

      await loadActivity();
    } catch (err) {
      console.error(
        "Failed to create employee note:",
        err,
      );

      window.alert(
        err instanceof Error
          ? err.message
          : "Failed to create note",
      );
    } finally {
      setSavingNote(false);
    }
  };

  const openDay = (
    day: EmployeeDailySummary,
  ) => {
    if (!employeeId) {
      return;
    }

    router.push(
      `/employees/${employeeId}/${day.date}`,
    );
  };

  const goBack = () => {
    router.push("/employees");
  };

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#09090b] text-white">
        <div className="mx-auto flex min-h-dvh max-w-6xl items-center justify-center px-4">
          <div className="text-sm text-zinc-400">
            Loading employee...
          </div>
        </div>
      </main>
    );
  }

  if (error || !employee) {
    return (
      <main className="min-h-dvh bg-[#09090b] text-white">
        <div className="mx-auto flex min-h-dvh max-w-6xl items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
            <h1 className="text-lg font-semibold">
              Unable to load employee
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              {error ?? "Employee not found."}
            </p>

            <button
              type="button"
              onClick={goBack}
              className="mt-6 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Back to employees
            </button>
          </div>
        </div>
      </main>
    );
  }

  const currentBalance = Number(
    balance?.balance ?? 0,
  );

  /*
   * Always display the newest date first.
   *
   * The backend already limits the current month to today, so no
   * future dates are introduced here.
   */
  const sortedCalendarDays = calendar?.days
    ? [...calendar.days].sort((a, b) =>
        b.date.localeCompare(a.date),
      )
    : [];

  return (
    <main className="min-h-dvh bg-[#09090b] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-6">
          <button
            type="button"
            onClick={goBack}
            className="mb-5 flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Employees
          </button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {employee.name}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                <span>
                  ₹{formatMoney(employee.daily_salary)} / day
                </span>

                <span className="text-zinc-700">
                  •
                </span>

                <span className="capitalize">
                  {employee.payment_method} payment
                </span>

                {!employee.is_active && (
                  <>
                    <span className="text-zinc-700">
                      •
                    </span>

                    <span className="text-amber-400">
                      Inactive
                    </span>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => openEventModal()}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              + Add transaction
            </button>
          </div>
        </header>

        {/* Balance */}
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Current balance
            </p>

            <p
              className={`mt-2 text-2xl font-semibold ${getBalanceClass(
                currentBalance,
              )}`}
            >
              {currentBalance < 0
                ? "-"
                : ""}
              ₹
              {formatMoney(
                Math.abs(currentBalance),
              )}
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              {getBalanceLabel(
                currentBalance,
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Daily salary
            </p>

            <p className="mt-2 text-2xl font-semibold text-white">
              ₹
              {formatMoney(
                employee.daily_salary,
              )}
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              Current rate
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              This month
            </p>

            <p className="mt-2 text-2xl font-semibold text-white">
              ₹
              {formatMoney(
                monthlySummary.salary,
              )}
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              Salary earned
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Working days
            </p>

            <p className="mt-2 text-2xl font-semibold text-white">
              {monthlySummary.workingDays}
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              {getMonthName(
                selectedYear,
                selectedMonth,
              )}
            </p>
          </div>
        </section>

        {/* Month navigation */}
        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
            >
              ←
            </button>

            <div className="text-center">
              <h2 className="text-base font-semibold">
                {formatMonth(
                  selectedYear,
                  selectedMonth,
                )}
              </h2>

              <p className="mt-0.5 text-xs text-zinc-600">
                {isCurrentMonth
                  ? "Current month — through today"
                  : "Full month"}
              </p>
            </div>

            <button
              type="button"
              onClick={goToNextMonth}
              disabled={!canGoNext}
              className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-30"
            >
              →
            </button>
          </div>

          {/* Calendar */}
          <div className="p-4 sm:p-5">
            {!sortedCalendarDays.length ? (
              <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center">
                <p className="text-sm text-zinc-500">
                  No days available for this month.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedCalendarDays.map(
                  (day) => {
                    const dayBalance =
                      Number(
                        day.balance ?? 0,
                      );

                    const isSelected =
                      selectedDay?.date ===
                      day.date;

                    const isToday =
                      day.date ===
                      todayString;

                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() =>
                          openDay(day)
                        }
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          isSelected
                            ? "border-zinc-600 bg-zinc-900"
                            : "border-zinc-800 bg-[#0d0d0f] hover:border-zinc-700 hover:bg-zinc-900/60"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-white">
                                {formatShortDate(
                                  day.date,
                                )}
                              </span>

                              {isToday && (
                                <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                                  Today
                                </span>
                              )}

                              {day.leave_no_salary && (
                                <span className="rounded-full border border-amber-900/50 bg-amber-950/30 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                                  No salary
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                              <span>
                                Salary ₹
                                {formatMoney(
                                  day.salary_earned,
                                )}
                              </span>

                              {Number(
                                day.overtime ??
                                  0,
                              ) > 0 && (
                                <span>
                                  Overtime +₹
                                  {formatMoney(
                                    day.overtime,
                                  )}
                                </span>
                              )}

                              {Number(
                                day.payments ??
                                  0,
                              ) > 0 && (
                                <span>
                                  Paid ₹
                                  {formatMoney(
                                    day.payments,
                                  )}
                                </span>
                              )}

                              {Number(
                                day.advances ??
                                  0,
                              ) > 0 && (
                                <span>
                                  Advance ₹
                                  {formatMoney(
                                    day.advances,
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                              Day balance
                            </p>

                            <p
                              className={`mt-1 text-sm font-semibold ${getDayBalanceClass(
                                dayBalance,
                              )}`}
                            >
                              {dayBalance < 0
                                ? "-"
                                : ""}
                              ₹
                              {formatMoney(
                                Math.abs(
                                  dayBalance,
                                ),
                              )}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </div>
        </section>

        {/* Selected day */}
        {selectedDay && (
          <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                  Daily details
                </p>

                <h2 className="mt-1 text-base font-semibold">
                  {formatDate(
                    selectedDay.date,
                  )}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedDay(null)
                }
                className="rounded-lg px-2 py-1 text-zinc-500 transition hover:bg-zinc-900 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-px bg-zinc-800 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-zinc-950 p-5">
                <p className="text-xs text-zinc-600">
                  Salary earned
                </p>

                <p className="mt-1 text-lg font-semibold text-white">
                  ₹
                  {formatMoney(
                    selectedDay.salary_earned,
                  )}
                </p>
              </div>

              <div className="bg-zinc-950 p-5">
                <p className="text-xs text-zinc-600">
                  Overtime
                </p>

                <p className="mt-1 text-lg font-semibold text-white">
                  ₹
                  {formatMoney(
                    selectedDay.overtime,
                  )}
                </p>
              </div>

              <div className="bg-zinc-950 p-5">
                <p className="text-xs text-zinc-600">
                  Payments
                </p>

                <p className="mt-1 text-lg font-semibold text-white">
                  ₹
                  {formatMoney(
                    selectedDay.payments,
                  )}
                </p>
              </div>

              <div className="bg-zinc-950 p-5">
                <p className="text-xs text-zinc-600">
                  Day balance
                </p>

                <p
                  className={`mt-1 text-lg font-semibold ${getDayBalanceClass(
                    Number(
                      selectedDay.balance ??
                        0,
                    ),
                  )}`}
                >
                  {Number(
                    selectedDay.balance ??
                      0,
                  ) < 0
                    ? "-"
                    : ""}
                  ₹
                  {formatMoney(
                    Math.abs(
                      Number(
                        selectedDay.balance ??
                          0,
                      ),
                    ),
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-zinc-800 p-5">
              <button
                type="button"
                onClick={() =>
                  openEventModal(
                    "overtime",
                  )
                }
                className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-900"
              >
                + Overtime
              </button>

              <button
                type="button"
                onClick={() =>
                  openEventModal(
                    "advance",
                  )
                }
                className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-900"
              >
                + Advance
              </button>

              <button
                type="button"
                onClick={() =>
                  openEventModal(
                    "payment",
                  )
                }
                className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-900"
              >
                + Payment
              </button>

              <button
                type="button"
                onClick={() =>
                  openEventModal(
                    "leave_no_salary",
                  )
                }
                className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-900"
              >
                Mark no salary
              </button>
            </div>
          </section>
        )}

        {/* Activity */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="border-b border-zinc-800 px-5 py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  Activity
                </h2>

                <p className="mt-1 text-xs text-zinc-600">
                  Transactions and notes for this employee
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowNoteModal(true)
                }
                className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-900"
              >
                + Add note
              </button>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() =>
                  setEventFilter("all")
                }
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition ${
                  eventFilter === "all"
                    ? "bg-white text-black"
                    : "border border-zinc-800 text-zinc-500 hover:text-white"
                }`}
              >
                All
              </button>

              {EVENT_TYPES.map(
                (type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() =>
                      setEventFilter(
                        type.value,
                      )
                    }
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition ${
                      eventFilter ===
                      type.value
                        ? "bg-white text-black"
                        : "border border-zinc-800 text-zinc-500 hover:text-white"
                    }`}
                  >
                    {type.label}
                  </button>
                ),
              )}
            </div>
          </div>

          {activityLoading ? (
            <div className="px-5 py-12 text-center text-sm text-zinc-600">
              Loading activity...
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {filteredEvents.length ===
                0 &&
              notes.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm text-zinc-500">
                    No activity yet.
                  </p>

                  <p className="mt-1 text-xs text-zinc-700">
                    Transactions and notes will appear here.
                  </p>
                </div>
              ) : (
                <>
                  {filteredEvents.map(
                    (event) => {
                      const amount =
                        Number(
                          event.amount ??
                            0,
                        );

                      return (
                        <div
                          key={event.id}
                          className="px-5 py-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-medium text-zinc-400">
                                  {getEventTypeLabel(
                                    event.event_type,
                                  )}
                                </span>

                                <span className="text-xs text-zinc-600">
                                  {formatDate(
                                    event.event_date,
                                  )}
                                </span>
                              </div>

                              <p className="mt-2 text-sm font-medium text-zinc-200">
                                {
                                  event.description
                                }
                              </p>

                              {event.note && (
                                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-zinc-600">
                                  {
                                    event.note
                                  }
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 text-right">
                              <p
                                className={`text-sm font-semibold ${
                                  event.event_type ===
                                  "overtime"
                                    ? "text-emerald-400"
                                    : event.event_type ===
                                        "leave_no_salary"
                                      ? "text-red-400"
                                      : "text-zinc-300"
                                }`}
                              >
                                {getEventSign(
                                  event.event_type,
                                )}
                                ₹
                                {formatMoney(
                                  Math.abs(
                                    amount,
                                  ),
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    },
                  )}

                  {notes.map(
                    (note) => (
                      <div
                        key={note.id}
                        className="px-5 py-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-500">
                            N
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-zinc-600">
                                {formatDate(
                                  note.note_date,
                                )}
                              </span>

                              <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                                Note
                              </span>
                            </div>

                            <h3 className="mt-1 text-sm font-medium text-zinc-200">
                              {
                                note.title
                              }
                            </h3>

                            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-zinc-600">
                              {
                                note.content
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Add transaction modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-800 bg-[#101012] p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Add transaction
                </h2>

                <p className="mt-1 text-xs text-zinc-600">
                  Add a financial event for{" "}
                  {employee.name}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEventModal}
                className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-900 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-400">
                  Transaction type
                </label>

                <select
                  value={eventType}
                  onChange={(event) =>
                    setEventType(
                      event.target
                        .value as EmployeeFinancialEventType,
                    )
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-zinc-600"
                >
                  {EVENT_TYPES.map(
                    (type) => (
                      <option
                        key={type.value}
                        value={type.value}
                      >
                        {type.label}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-400">
                  Date
                </label>

                <input
                  type="date"
                  value={eventDate}
                  onChange={(event) =>
                    setEventDate(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-zinc-600"
                />
              </div>

              {eventType !==
                "leave_no_salary" && (
                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-400">
                    Amount
                  </label>

                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-600">
                      ₹
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={eventAmount}
                      onChange={(event) =>
                        setEventAmount(
                          event.target.value,
                        )
                      }
                      placeholder="0.00"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-3 pl-8 pr-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-400">
                  Description
                </label>

                <input
                  type="text"
                  value={eventDescription}
                  onChange={(event) =>
                    setEventDescription(
                      event.target.value,
                    )
                  }
                  placeholder={
                    eventType ===
                    "advance"
                      ? "e.g. Cash advance"
                      : eventType ===
                          "overtime"
                        ? "e.g. Extra work"
                        : eventType ===
                            "payment"
                          ? "e.g. Salary paid"
                          : eventType ===
                              "leave_no_salary"
                            ? "e.g. Leave"
                            : "e.g. Debt adjustment"
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-400">
                  Note
                  <span className="ml-1 text-zinc-700">
                    optional
                  </span>
                </label>

                <textarea
                  rows={3}
                  value={eventNote}
                  onChange={(event) =>
                    setEventNote(
                      event.target.value,
                    )
                  }
                  placeholder="Additional details..."
                  className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeEventModal}
                disabled={savingEvent}
                className="flex-1 rounded-xl border border-zinc-800 px-4 py-3 text-sm text-zinc-400 transition hover:bg-zinc-900 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void createEvent()
                }
                disabled={
                  savingEvent ||
                  !eventDate ||
                  (eventType !==
                    "leave_no_salary" &&
                    (!eventAmount ||
                      Number(
                        eventAmount,
                      ) <= 0))
                }
                className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingEvent
                  ? "Saving..."
                  : "Save transaction"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add note modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="w-full rounded-t-3xl border border-zinc-800 bg-[#101012] p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Add note
                </h2>

                <p className="mt-1 text-xs text-zinc-600">
                  Keep a record about this employee
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowNoteModal(false)
                }
                className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-900 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-400">
                  Date
                </label>

                <input
                  type="date"
                  value={noteDate}
                  onChange={(event) =>
                    setNoteDate(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-zinc-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-400">
                  Title
                </label>

                <input
                  type="text"
                  value={noteTitle}
                  onChange={(event) =>
                    setNoteTitle(
                      event.target.value,
                    )
                  }
                  placeholder="e.g. Employee requested leave"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-400">
                  Note
                </label>

                <textarea
                  rows={5}
                  value={noteContent}
                  onChange={(event) =>
                    setNoteContent(
                      event.target.value,
                    )
                  }
                  placeholder="Write the note..."
                  className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowNoteModal(false)
                }
                disabled={savingNote}
                className="flex-1 rounded-xl border border-zinc-800 px-4 py-3 text-sm text-zinc-400 transition hover:bg-zinc-900 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void createNote()
                }
                disabled={
                  savingNote ||
                  !noteTitle.trim() ||
                  !noteContent.trim()
                }
                className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingNote
                  ? "Saving..."
                  : "Save note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

