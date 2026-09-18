"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  Employee,
  EmployeeCalendar,
  EmployeeDailySummary,
} from "@blacklane-ledger/sdk";
import { sdk } from "@/lib/api";

/**
 * Brand palette — sourced from the Blacklane Ledger brand sheet (Dark Mode set).
 *
 *   Text / Primary  #FAFAFA
 *   Secondary       #9CA3AF
 *   Muted           #6B7280
 *   Surface         #1F2937
 *   Background      #0B0F14
 *
 * The brand sheet doesn't give hex values for the border, accent, warning,
 * or error colors it uses visually (border is implied by contrast, the
 * accent is the deep green swatch next to the palette, and there's no
 * warning/error color at all). Those are best-guess approximations below —
 * swap them for exact values if you have them.
 */
const colors = {
  background: "#0B0F14",
  surface: "#1F2937",
  border: "rgba(156, 163, 175, 0.16)", // derived from Secondary #9CA3AF at low opacity
  text: "#FAFAFA",
  secondary: "#9CA3AF",
  muted: "#6B7280",
  accent: "#1F7A5C", // approximation of the brand sheet's deep-green swatch
  accentSoft: "rgba(31, 122, 94, 0.16)",
  warning: "#C49A5A",
  error: "#E08A6E", // not in the brand sheet — kept from the previous build
  errorBackground: "rgba(224, 138, 110, 0.12)",
};

function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function formatMonth(monthString: string): string {
  const date = parseLocalDate(`${monthString}-01`);

  return date.toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

function formatDate(dateString: string): {
  weekday: string;
  day: string;
  month: string;
} {
  const date = parseLocalDate(dateString);

  return {
    weekday: date.toLocaleDateString("en-MY", {
      weekday: "short",
    }),
    day: date.toLocaleDateString("en-MY", {
      day: "2-digit",
    }),
    month: date.toLocaleDateString("en-MY", {
      month: "short",
    }),
  };
}

function isCurrentMonth(monthString: string, today: string): boolean {
  return monthString === today.slice(0, 7);
}

function isToday(dateString: string, today: string): boolean {
  return dateString === today;
}

export default function EmployeeDateSelectionPage() {
  const params = useParams();
  const router = useRouter();

  const employeeId = params.employeeId as string;

  const [businessId, setBusinessId] = useState<string | null>(null);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [calendar, setCalendar] = useState<EmployeeCalendar | null>(null);

  const [loadingEmployee, setLoadingEmployee] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(true);

  const [error, setError] = useState<string | null>(null);

  /*
   * Use the browser's local calendar date.
   *
   * Do NOT use:
   * new Date().toISOString().split("T")[0]
   *
   * because that converts the date to UTC first.
   *
   * This is important around midnight in Malaysia (UTC+8).
   */
  const today = useMemo(() => getLocalDateString(), []);

  const [selectedMonth, setSelectedMonth] = useState(
    getMonthString(new Date())
  );

  /*
   * Get the business ID from localStorage.
   */
  useEffect(() => {
    const storedBusinessId = localStorage.getItem("business_id");

    if (!storedBusinessId || storedBusinessId === "businessId") {
      router.replace("/businesses");
      return;
    }

    setBusinessId(storedBusinessId);
  }, [router]);

  const loadEmployee = useCallback(async () => {
    if (!businessId) {
      return;
    }

    try {
      setLoadingEmployee(true);
      setError(null);

      const result = await sdk.employees.get(
        businessId,
        employeeId
      );

      setEmployee(result);
    } catch (err) {
      console.error("Failed to load employee:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load employee."
      );
    } finally {
      setLoadingEmployee(false);
    }
  }, [businessId, employeeId]);

  const loadCalendar = useCallback(async () => {
    if (!businessId) {
      return;
    }

    try {
      setLoadingCalendar(true);

      const [yearString, monthString] = selectedMonth.split("-");

      const year = Number(yearString);
      const month = Number(monthString);

      const result = await sdk.employees.calendar(
        businessId,
        employeeId,
        year,
        month
      );

      setCalendar(result);
    } catch (err) {
      console.error("Failed to load employee calendar:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load employee dates."
      );
    } finally {
      setLoadingCalendar(false);
    }
  }, [businessId, employeeId, selectedMonth]);

  useEffect(() => {
    void loadEmployee();
  }, [loadEmployee]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  /*
   * Newest dates first.
   *
   * For the current month, today will therefore be at the top.
   */
  const sortedDays = useMemo(() => {
    if (!calendar?.days) {
      return [];
    }

    return [...calendar.days].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }, [calendar]);

  /*
   * has_record is the backend source of truth.
   *
   * Do not use salary_amount here because zero salary can be valid
   * for leave.
   */
  const incompleteDays = useMemo(() => {
    return sortedDays.filter((day) => !day.has_record);
  }, [sortedDays]);

  const monthIsCurrent = isCurrentMonth(selectedMonth, today);

  const canGoNextMonth = useMemo(() => {
    const currentMonth = today.slice(0, 7);

    return selectedMonth < currentMonth;
  }, [selectedMonth, today]);

  const canGoPreviousMonth = useMemo(() => {
    if (!employee?.accounting_start_date) {
      return true;
    }

    const accountingMonth =
      employee.accounting_start_date.slice(0, 7);

    return selectedMonth > accountingMonth;
  }, [employee?.accounting_start_date, selectedMonth]);

  const goToPreviousMonth = () => {
    if (!canGoPreviousMonth) {
      return;
    }

    const date = parseLocalDate(`${selectedMonth}-01`);

    date.setMonth(date.getMonth() - 1);

    setSelectedMonth(getMonthString(date));
  };

  const goToNextMonth = () => {
    if (!canGoNextMonth) {
      return;
    }

    const date = parseLocalDate(`${selectedMonth}-01`);

    date.setMonth(date.getMonth() + 1);

    const nextMonth = getMonthString(date);

    if (nextMonth <= today.slice(0, 7)) {
      setSelectedMonth(nextMonth);
    }
  };

  const goToToday = () => {
    setSelectedMonth(today.slice(0, 7));
  };

  const handleDateClick = (day: EmployeeDailySummary) => {
    router.push(`/employees/${employeeId}/${day.date}`);
  };

  if (loadingEmployee) {
    return (
      <main
        className="min-h-screen pb-28"
        style={{
          backgroundColor: colors.background,
          color: colors.text,
        }}
      >
        <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center justify-center px-4">
          <p
            className="text-sm"
            style={{ color: colors.secondary }}
          >
            Loading employee...
          </p>
        </div>
      </main>
    );
  }

  if (!employee) {
    return (
      <main
        className="min-h-screen pb-28"
        style={{
          backgroundColor: colors.background,
          color: colors.text,
        }}
      >
        <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
          <button
            type="button"
            onClick={() => router.push("/employees")}
            className="mb-6 inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
            style={{ color: colors.secondary }}
          >
            <span className="text-lg leading-none">←</span>
            Employees
          </button>

          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: colors.errorBackground,
              color: colors.error,
              border: `1px solid ${colors.border}`,
            }}
          >
            {error ?? "Employee not found."}
          </div>
        </div>

        <BottomNavigation />
      </main>
    );
  }

  return (
    <main
      className="min-h-screen pb-28"
      style={{
        backgroundColor: colors.background,
        color: colors.text,
      }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => router.push("/employees")}
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-opacity hover:opacity-80"
              style={{
                color: colors.secondary,
              }}
              aria-label="Back to employees"
            >
              <span className="text-xl leading-none">←</span>
            </button>

            <div className="min-w-0">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: colors.accent }}
              >
                Employee records
              </p>

              <h1
                className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl"
                style={{ color: colors.text }}
              >
                {employee.name}
              </h1>

              <p
                className="mt-1 text-sm"
                style={{ color: colors.secondary }}
              >
                Select a date to manage the daily record
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="More options"
            title="Export, settings, and help — coming soon"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg transition-opacity hover:opacity-70"
            style={{ color: colors.secondary }}
          >
            ⋯
          </button>
        </div>

        {/* Accounting start */}
        <div
          className="mb-5 text-xs"
          style={{ color: colors.muted }}
        >
          Records from{" "}
          <span style={{ color: colors.secondary }}>
            {parseLocalDate(
              employee.accounting_start_date
            ).toLocaleDateString("en-MY", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Month selector */}
        <section
          className="mb-4 rounded-lg"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div className="flex items-center justify-between px-3 py-3">
            <button
              type="button"
              onClick={goToPreviousMonth}
              disabled={!canGoPreviousMonth}
              className="flex h-9 w-9 items-center justify-center rounded-md text-xl leading-none transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-25"
              style={{ color: colors.secondary }}
              aria-label="Previous month"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={goToToday}
              className="text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: colors.text }}
            >
              {formatMonth(selectedMonth)}
            </button>

            <button
              type="button"
              onClick={goToNextMonth}
              disabled={!canGoNextMonth}
              className="flex h-9 w-9 items-center justify-center rounded-md text-xl leading-none transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-25"
              style={{ color: colors.secondary }}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </section>

        {/* Completion summary */}
        {!loadingCalendar && incompleteDays.length > 0 && (
          <div className="mb-4 px-1">
            <p
              className="text-xs"
              style={{ color: colors.secondary }}
            >
              <span
                className="font-semibold"
                style={{ color: colors.warning }}
              >
                {incompleteDays.length}{" "}
                {incompleteDays.length === 1 ? "day" : "days"}
              </span>{" "}
              need filling
            </p>
          </div>
        )}

        {!loadingCalendar && incompleteDays.length === 0 && (
          <div className="mb-4 px-1">
            <p
              className="text-xs"
              style={{ color: colors.muted }}
            >
              All available days are filled
            </p>
          </div>
        )}

        {/* Date list */}
        <section
          className="overflow-hidden rounded-lg"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          {loadingCalendar ? (
            <div className="space-y-px">
              <div
                className="h-14 animate-pulse"
                style={{ backgroundColor: colors.surface }}
              />
              <div
                className="h-14 animate-pulse"
                style={{ backgroundColor: colors.surface }}
              />
              <div
                className="h-14 animate-pulse"
                style={{ backgroundColor: colors.surface }}
              />
            </div>
          ) : sortedDays.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p
                className="text-sm"
                style={{ color: colors.secondary }}
              >
                No dates available for this month.
              </p>
            </div>
          ) : (
            sortedDays.map((day, index) => {
              const dateInfo = formatDate(day.date);
              const todayDate = isToday(day.date, today);
              const incomplete = !day.has_record;

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => handleDateClick(day)}
                  className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-opacity hover:opacity-80"
                  style={{
                    borderTop:
                      index === 0
                        ? undefined
                        : `1px solid ${colors.border}`,
                    backgroundColor: todayDate
                      ? colors.accentSoft
                      : colors.surface,
                  }}
                >
                  {/* Date */}
                  <div className="w-14 shrink-0 text-center">
                    <p
                      className="text-[10px] font-medium uppercase tracking-wide"
                      style={{ color: colors.muted }}
                    >
                      {dateInfo.month}
                    </p>

                    <p
                      className="mt-0.5 text-xl font-bold leading-tight"
                      style={{
                        color: todayDate
                          ? colors.accent
                          : colors.text,
                      }}
                    >
                      {dateInfo.day}
                    </p>
                  </div>

                  {/* Day information */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className="text-sm font-semibold"
                        style={{
                          color: todayDate
                            ? colors.accent
                            : colors.text,
                        }}
                      >
                        {dateInfo.weekday}
                      </p>

                      {todayDate && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            color: colors.accent,
                            backgroundColor: colors.accentSoft,
                          }}
                        >
                          Today
                        </span>
                      )}
                    </div>

                    <p
                      className="mt-0.5 text-xs"
                      style={{ color: colors.muted }}
                    >
                      {day.date}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex shrink-0 items-center gap-2">
                    {incomplete && (
                      <>
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            backgroundColor: colors.warning,
                          }}
                          aria-hidden="true"
                        />

                        <span
                          className="text-[11px]"
                          style={{ color: colors.muted }}
                        >
                          Pending
                        </span>
                      </>
                    )}

                    <span
                      className="ml-1 text-lg leading-none"
                      style={{ color: colors.muted }}
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </section>

        {/* Current month note */}
        {monthIsCurrent && (
          <p
            className="mt-4 text-center text-[11px]"
            style={{ color: colors.muted }}
          >
            Dates after today are not available yet.
          </p>
        )}

        {/* Error */}
        {error && (
          <div
            className="mt-4 rounded-md px-4 py-3 text-sm"
            style={{
              backgroundColor: colors.errorBackground,
              color: colors.error,
              border: `1px solid ${colors.border}`,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Fixed bottom navigation */}
      <BottomNavigation />
    </main>
  );
}

function BottomNavigation() {
  const items = [
    { label: "Dashboard", href: "/dashboard", active: false },
    { label: "Sales", href: "/sales", active: false },
    { label: "Expenses", href: "/expenses", active: false },
    { label: "More", href: "/more", active: false },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t md:hidden"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          className="flex min-h-16 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-opacity hover:opacity-80"
          style={{
            color: item.active ? colors.accent : colors.secondary,
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}