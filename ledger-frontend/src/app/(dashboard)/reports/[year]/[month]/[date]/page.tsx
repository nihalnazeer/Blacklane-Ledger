"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { DailyClosing, ReportDaily } from "@blacklane-ledger/sdk";

import { sdk } from "@/lib/api";

const colors = {
  background: "#0B0F14",
  surface: "#1F2937",
  border: "rgba(156, 163, 175, 0.16)",
  text: "#FAFAFA",
  secondary: "#9CA3AF",
  muted: "#6B7280",
  accent: "#1F7A5C",
  accentSoft: "rgba(31, 122, 94, 0.16)",
  accentBorder: "rgba(31, 122, 94, 0.5)",
  warning: "#D8B477",
  warningSoft: "rgba(216, 180, 119, 0.08)",
  warningBorder: "rgba(216, 180, 119, 0.35)",
  error: "#E08A6E",
  errorBackground: "rgba(224, 138, 110, 0.12)",
};

function formatMoney(value: string | number): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "0.00";
  }

  return amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatFullDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Date(year, month - 1, day).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

function getErrorStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }

  const candidate = err as {
    status?: unknown;
    response?: {
      status?: unknown;
    };
  };

  if (typeof candidate.status === "number") {
    return candidate.status;
  }

  if (typeof candidate.response?.status === "number") {
    return candidate.response.status;
  }

  return undefined;
}

function describeError(err: unknown): {
  message: string;
  status?: number;
} {
  const status = getErrorStatus(err);

  if (status === 401) {
    return {
      message: "Your session has expired. Please sign in again.",
      status,
    };
  }

  if (status === 404) {
    return {
      message: "No report data was found for this date.",
      status,
    };
  }

  return {
    message:
      err instanceof Error
        ? err.message
        : "Unable to load the daily report.",
    status,
  };
}

function ExpenseRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-3"
      style={{ borderBottom: `1px solid ${colors.border}` }}
    >
      <span className="text-sm" style={{ color: colors.secondary }}>
        {label}
      </span>

      <span
        className="text-sm font-semibold"
        style={{ color: colors.text }}
      >
        RM {formatMoney(value)}
      </span>
    </div>
  );
}

function ReviewCheck({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-opacity hover:opacity-90"
      style={{
        backgroundColor: checked
          ? colors.accentSoft
          : colors.background,
        border: `1px solid ${
          checked ? colors.accentBorder : colors.border
        }`,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#1F7A5C]"
      />

      <span
        className="text-sm leading-5"
        style={{ color: checked ? colors.text : colors.secondary }}
      >
        {label}
      </span>
    </label>
  );
}

export default function DailyReportPage() {
  const router = useRouter();
  const params = useParams<{
    year: string;
    month: string;
    date: string;
  }>();

  const year = Number(params.year);
  const month = Number(params.month);
  const date = params.date;

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportDaily | null>(null);
  const [closing, setClosing] = useState<DailyClosing | null>(null);

  const [salesReviewed, setSalesReviewed] = useState(false);
  const [expensesReviewed, setExpensesReviewed] = useState(false);
  const [employeesReviewed, setEmployeesReviewed] = useState(false);
  const [balanceReviewed, setBalanceReviewed] = useState(false);
  const [note, setNote] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isClosingLoading, setIsClosingLoading] = useState(true);
  const [isClosingDay, setIsClosingDay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closingError, setClosingError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const storedBusinessId = localStorage.getItem("business_id");

    if (!storedBusinessId || storedBusinessId === "businessId") {
      router.replace("/businesses");
      return;
    }

    setBusinessId(storedBusinessId);
  }, [router]);

  const loadReport = useCallback(async () => {
    if (!businessId || !date) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSessionExpired(false);

    try {
      const data = await sdk.reports.daily(businessId, date);
      setReport(data);
    } catch (err) {
      const { message, status } = describeError(err);

      setReport(null);

      if (status === 401) {
        setSessionExpired(true);
      }

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [businessId, date]);

  const loadClosing = useCallback(async () => {
    if (!businessId || !date) {
      return;
    }

    setIsClosingLoading(true);
    setClosingError(null);

    try {
      const data = await sdk.reports.getDailyClosing(businessId, date);

      // A 204 response means the daily report has not been closed yet.
      // The SDK returns undefined for a 204 No Content response.
      if (!data) {
        setClosing(null);
        setNote("");
        return;
      }

      setClosing(data);
      setNote(data.note ?? "");
    } catch (err) {
      const status = getErrorStatus(err);

      // A missing closing record means the day simply has not been closed yet.
      if (status === 404) {
        setClosing(null);
        setNote("");
      } else if (status === 401) {
        setSessionExpired(true);
        setClosingError("Your session has expired. Please sign in again.");
      } else {
        console.error("Failed to load daily closing:", err);
        setClosingError("Unable to load the day closing status.");
      }
    } finally {
      setIsClosingLoading(false);
    }
  }, [businessId, date]);

  useEffect(() => {
    void loadReport();
    void loadClosing();
  }, [loadReport, loadClosing]);

  const monthLabel = useMemo(() => {
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return "";
    }

    return formatMonthLabel(year, month);
  }, [year, month]);

  const isClosed = closing?.is_closed ?? false;

  const allChecksComplete =
    salesReviewed &&
    expensesReviewed &&
    employeesReviewed &&
    balanceReviewed;

  const canClose = Boolean(report) && allChecksComplete && !isClosed;

  function handleSignOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("business_id");
    router.replace("/login");
  }

  function goBackToMonth() {
    router.push(
      `/reports/${params.year}/${String(month).padStart(2, "0")}`,
    );
  }

  async function handleCloseDay() {
    if (!businessId || !date || !report || !canClose) {
      return;
    }

    setIsClosingDay(true);
    setClosingError(null);

    try {
      const data = await sdk.reports.closeDay(businessId, date, {
        note: note.trim() || null,
      });

      setClosing(data);
    } catch (err) {
      const { message, status } = describeError(err);

      if (status === 401) {
        setSessionExpired(true);
      }

      setClosingError(
        status === 409
          ? "This day has changed or was already closed. Refresh the report and review it again."
          : message || "Unable to close this day.",
      );
    } finally {
      setIsClosingDay(false);
    }
  }

  return (
    <main
      className="min-h-screen"
      style={{
        backgroundColor: colors.background,
        color: colors.text,
      }}
    >
      <div
        className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8"
        style={{
          paddingBottom:
            "calc(env(safe-area-inset-bottom, 0px) + 104px)",
        }}
      >
        <div className="mb-6">
          <button
            type="button"
            onClick={goBackToMonth}
            className="mb-5 flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
            style={{ color: colors.secondary }}
          >
            <span aria-hidden="true">←</span>
            <span>Back to {monthLabel}</span>
          </button>

          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: colors.accent }}
          >
            Day review
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1
              className="text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ color: colors.text }}
            >
              {date ? formatFullDate(date) : "Daily report"}
            </h1>

            {!isClosingLoading && (
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                style={{
                  border: `1px solid ${
                    isClosed
                      ? colors.accentBorder
                      : colors.warningBorder
                  }`,
                  backgroundColor: isClosed
                    ? colors.accentSoft
                    : colors.warningSoft,
                  color: isClosed ? colors.accent : colors.warning,
                }}
              >
                {isClosed ? "Closed" : "Review needed"}
              </span>
            )}
          </div>

          <p
            className="mt-2 text-sm leading-5"
            style={{ color: colors.secondary }}
          >
            Review today&apos;s sales, expenses, employees, and final
            balance before closing the day.
          </p>
        </div>

        {sessionExpired ? (
          <div
            className="mb-5 flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: colors.errorBackground,
              color: colors.error,
            }}
          >
            <span>Your session has expired. Please sign in again.</span>

            <button
              type="button"
              onClick={handleSignOut}
              className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold"
              style={{
                borderColor: colors.error,
                color: colors.error,
              }}
            >
              Sign in
            </button>
          </div>
        ) : error ? (
          <section
            className="rounded-lg px-5 py-6"
            style={{
              backgroundColor: colors.errorBackground,
              border: `1px solid ${colors.border}`,
            }}
          >
            <p
              className="text-sm"
              style={{ color: colors.error }}
            >
              {error}
            </p>

            <button
              type="button"
              onClick={() => {
                void loadReport();
                void loadClosing();
              }}
              className="mt-4 rounded-md px-4 py-2 text-sm font-semibold"
              style={{
                backgroundColor: colors.accent,
                color: colors.text,
              }}
            >
              Try again
            </button>
          </section>
        ) : isLoading ? (
          <div className="space-y-4">
            <section
              className="h-32 animate-pulse rounded-lg"
              style={{ backgroundColor: colors.surface }}
            />

            <section
              className="h-64 animate-pulse rounded-lg"
              style={{ backgroundColor: colors.surface }}
            />

            <section
              className="h-64 animate-pulse rounded-lg"
              style={{ backgroundColor: colors.surface }}
            />
          </div>
        ) : report ? (
          <div className="space-y-5">
            {/* Day summary */}
            <section
              className="rounded-2xl p-5"
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="mb-4">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: colors.secondary }}
                >
                  Day summary
                </p>

                <p
                  className="mt-1 text-xs"
                  style={{ color: colors.muted }}
                >
                  Current accounting position for this date.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div
                  className="rounded-xl p-4"
                  style={{
                    backgroundColor: colors.background,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <p
                    className="text-xs"
                    style={{ color: colors.secondary }}
                  >
                    Cash sales
                  </p>
                  <p
                    className="mt-1 text-lg font-bold"
                    style={{ color: colors.text }}
                  >
                    RM {formatMoney(report.cash_sales)}
                  </p>
                </div>

                <div
                  className="rounded-xl p-4"
                  style={{
                    backgroundColor: colors.background,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <p
                    className="text-xs"
                    style={{ color: colors.secondary }}
                  >
                    Total expenses
                  </p>
                  <p
                    className="mt-1 text-lg font-bold"
                    style={{ color: colors.text }}
                  >
                    RM {formatMoney(report.expenses.total)}
                  </p>
                </div>

                <div
                  className="rounded-xl p-4"
                  style={{
                    backgroundColor: colors.background,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <p
                    className="text-xs"
                    style={{ color: colors.secondary }}
                  >
                    Final balance
                  </p>
                  <p
                    className="mt-1 text-lg font-bold"
                    style={{
                      color:
                        Number(report.balance) >= 0
                          ? colors.accent
                          : colors.error,
                    }}
                  >
                    RM {formatMoney(report.balance)}
                  </p>
                </div>
              </div>
            </section>

            {/* Sales */}
            <section
              className="rounded-lg p-5"
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: colors.secondary }}
                  >
                    Sales
                  </p>

                  <p
                    className="mt-1 text-xs"
                    style={{ color: colors.muted }}
                  >
                    Cash sales recorded for the day.
                  </p>
                </div>

                <span
                  className="rounded-full px-2 py-1 text-[10px] font-semibold"
                  style={{
                    backgroundColor: salesReviewed
                      ? colors.accentSoft
                      : colors.warningSoft,
                    color: salesReviewed
                      ? colors.accent
                      : colors.warning,
                  }}
                >
                  {salesReviewed ? "Reviewed" : "Review needed"}
                </span>
              </div>

              <p
                className="mt-4 text-4xl font-bold tracking-tight"
                style={{ color: colors.text }}
              >
                RM {formatMoney(report.cash_sales)}
              </p>

              <div className="mt-5">
                <ReviewCheck
                  checked={salesReviewed}
                  onChange={setSalesReviewed}
                  label="I reviewed today's sales."
                />
              </div>
            </section>

            {/* Expenses */}
            <section
              className="rounded-lg p-5"
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: colors.secondary }}
                  >
                    Expenses
                  </p>

                  <p
                    className="mt-1 text-xs"
                    style={{ color: colors.muted }}
                  >
                    General, utility, other, and employee expenses.
                  </p>
                </div>

                <span
                  className="rounded-full px-2 py-1 text-[10px] font-semibold"
                  style={{
                    backgroundColor: expensesReviewed
                      ? colors.accentSoft
                      : colors.warningSoft,
                    color: expensesReviewed
                      ? colors.accent
                      : colors.warning,
                  }}
                >
                  {expensesReviewed ? "Reviewed" : "Review needed"}
                </span>
              </div>

              <ExpenseRow
                label="General expenses"
                value={report.expenses.general}
              />

              <ExpenseRow
                label="Utility expenses"
                value={report.expenses.utility}
              />

              <ExpenseRow
                label="Other expenses"
                value={report.expenses.other}
              />

              <ExpenseRow
                label="Employee salary"
                value={report.expenses.employee_salary}
              />

              <ExpenseRow
                label="Overtime"
                value={report.expenses.overtime}
              />

              <div className="flex items-center justify-between gap-4 pt-4">
                <span
                  className="text-sm font-semibold"
                  style={{ color: colors.text }}
                >
                  Total expenses
                </span>

                <span
                  className="text-lg font-bold"
                  style={{ color: colors.text }}
                >
                  RM {formatMoney(report.expenses.total)}
                </span>
              </div>

              <div className="mt-5">
                <ReviewCheck
                  checked={expensesReviewed}
                  onChange={setExpensesReviewed}
                  label="I reviewed today's expenses."
                />
              </div>
            </section>

            {/* Employees */}
            <section
              className="rounded-lg p-5"
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: colors.secondary }}
                  >
                    Employees
                  </p>

                  <p
                    className="mt-1 text-xs leading-5"
                    style={{ color: colors.muted }}
                  >
                    Review the employee salary and overtime included
                    in today&apos;s expenses.
                  </p>
                </div>

                <span
                  className="rounded-full px-2 py-1 text-[10px] font-semibold"
                  style={{
                    backgroundColor: employeesReviewed
                      ? colors.accentSoft
                      : colors.warningSoft,
                    color: employeesReviewed
                      ? colors.accent
                      : colors.warning,
                  }}
                >
                  {employeesReviewed ? "Reviewed" : "Review needed"}
                </span>
              </div>

              <div
                className="mt-4 flex items-center justify-between rounded-xl px-4 py-3"
                style={{
                  backgroundColor: colors.background,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <span
                  className="text-sm"
                  style={{ color: colors.secondary }}
                >
                  Employee salary
                </span>

                <span
                  className="text-sm font-semibold"
                  style={{ color: colors.text }}
                >
                  RM {formatMoney(report.expenses.employee_salary)}
                </span>
              </div>

              <div
                className="mt-2 flex items-center justify-between rounded-xl px-4 py-3"
                style={{
                  backgroundColor: colors.background,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <span
                  className="text-sm"
                  style={{ color: colors.secondary }}
                >
                  Overtime
                </span>

                <span
                  className="text-sm font-semibold"
                  style={{ color: colors.text }}
                >
                  RM {formatMoney(report.expenses.overtime)}
                </span>
              </div>

              <div className="mt-5">
                <ReviewCheck
                  checked={employeesReviewed}
                  onChange={setEmployeesReviewed}
                  label="I reviewed today's employees."
                />
              </div>
            </section>

            {/* Final balance */}
            <section
              className="rounded-lg p-5"
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: colors.secondary }}
                  >
                    Final balance
                  </p>

                  <p
                    className="mt-1 text-xs"
                    style={{ color: colors.muted }}
                  >
                    Cash sales minus all daily operating expenses.
                  </p>
                </div>

                <span
                  className="rounded-full px-2 py-1 text-[10px] font-semibold"
                  style={{
                    backgroundColor: balanceReviewed
                      ? colors.accentSoft
                      : colors.warningSoft,
                    color: balanceReviewed
                      ? colors.accent
                      : colors.warning,
                  }}
                >
                  {balanceReviewed ? "Reviewed" : "Review needed"}
                </span>
              </div>

              <p
                className="mt-4 text-4xl font-bold tracking-tight"
                style={{
                  color:
                    Number(report.balance) >= 0
                      ? colors.accent
                      : colors.error,
                }}
              >
                RM {formatMoney(report.balance)}
              </p>

              <p
                className="mt-3 text-xs leading-5"
                style={{ color: colors.muted }}
              >
                This value is calculated from the current report data.
                It is not a separate amount that needs to be entered.
              </p>

              <div className="mt-5">
                <ReviewCheck
                  checked={balanceReviewed}
                  onChange={setBalanceReviewed}
                  label="I reviewed the final balance."
                />
              </div>
            </section>

            {/* Closing */}
            <section
              className="rounded-2xl p-5"
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="mb-4">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: colors.secondary }}
                >
                  Close day
                </p>

                {isClosed ? (
                  <p
                    className="mt-2 text-sm leading-5"
                    style={{ color: colors.accent }}
                  >
                    This day is closed. The underlying accounting data
                    remains editable; if it changes, the day will need
                    to be reviewed again.
                  </p>
                ) : (
                  <p
                    className="mt-2 text-sm leading-5"
                    style={{ color: colors.secondary }}
                  >
                    All four section reviews must be completed before the
                    day can be closed. Closing does not lock the day.
                  </p>
                )}
              </div>

              <div
                className="space-y-2 rounded-xl p-3"
                style={{
                  backgroundColor: colors.background,
                  border: `1px solid ${colors.border}`,
                }}
              >
                {[
                  ["Sales", salesReviewed],
                  ["Expenses", expensesReviewed],
                  ["Employees", employeesReviewed],
                  ["Final balance", balanceReviewed],
                ].map(([label, checked]) => (
                  <div
                    key={String(label)}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                  >
                    <span
                      className="text-sm"
                      style={{
                        color: checked ? colors.text : colors.secondary,
                      }}
                    >
                      {label}
                    </span>

                    <span
                      className="text-sm font-semibold"
                      style={{
                        color: checked ? colors.accent : colors.warning,
                      }}
                    >
                      {checked ? "✓ Reviewed" : "Review needed"}
                    </span>
                  </div>
                ))}
              </div>

              <label className="mt-4 block">
                <span
                  className="text-xs font-medium"
                  style={{ color: colors.secondary }}
                >
                  Note (optional)
                </span>

                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={isClosed || isClosingDay}
                  rows={3}
                  placeholder="Add a note about this day's review..."
                  className="mt-2 w-full resize-none rounded-xl px-3 py-3 text-sm outline-none"
                  style={{
                    backgroundColor: colors.background,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                  }}
                />
              </label>

              {closingError && (
                <div
                  className="mt-4 rounded-xl px-4 py-3 text-sm leading-5"
                  style={{
                    backgroundColor: colors.errorBackground,
                    border: `1px solid rgba(224, 138, 110, 0.35)`,
                    color: colors.error,
                  }}
                >
                  {closingError}
                </div>
              )}

              {!isClosed && (
                <>
                  {!allChecksComplete && (
                    <p
                      className="mt-4 text-xs leading-5"
                      style={{ color: colors.warning }}
                    >
                      Complete all four review checks before closing
                      the day.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleCloseDay()}
                    disabled={!canClose || isClosingDay}
                    className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      backgroundColor: colors.accent,
                      color: colors.text,
                    }}
                  >
                    {isClosingDay ? "Closing day..." : "Close Day"}
                  </button>
                </>
              )}

              {isClosed && closing?.closed_at && (
                <div
                  className="mt-4 rounded-xl px-4 py-3"
                  style={{
                    backgroundColor: colors.accentSoft,
                    border: `1px solid ${colors.accentBorder}`,
                  }}
                >
                  <p
                    className="text-xs"
                    style={{ color: colors.secondary }}
                  >
                    Closed at
                  </p>

                  <p
                    className="mt-1 text-sm font-semibold"
                    style={{ color: colors.accent }}
                  >
                    {new Date(closing.closed_at).toLocaleString("en-MY", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              )}
            </section>

            <button
              type="button"
              onClick={goBackToMonth}
              className="flex min-h-12 w-full items-center justify-center rounded-md px-5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                backgroundColor: colors.accentSoft,
                color: colors.accent,
              }}
            >
              Back to monthly report
            </button>
          </div>
        ) : null}
      </div>

      {/* Bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t md:hidden"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {[
          {
            label: "Dashboard",
            href: "/dashboard",
            active: false,
          },
          {
            label: "Sales",
            href: "/sales",
            active: false,
          },
          {
            label: "Expenses",
            href: "/expenses",
            active: false,
          },
          {
            label: "More",
            href: "/more",
            active: false,
          },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="flex min-h-14 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium"
            style={{
              color: item.active
                ? colors.accent
                : colors.secondary,
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </main>
  );
}