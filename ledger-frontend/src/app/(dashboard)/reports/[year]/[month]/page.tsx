
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { sdk } from "@/lib/api";
import type {
  MonthlyClosing,
  ReportMonthly,
} from "@blacklane-ledger/sdk";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const colors = {
  background: "#0B0F14",
  surface: "#1F2937",
  border: "rgba(156, 163, 175, 0.16)",
  text: "#FAFAFA",
  secondary: "#9CA3AF",
  muted: "#6B7280",
  accent: "#1F7A5C",
  accentSoft: "rgba(31, 122, 94, 0.16)",
  error: "#E08A6E",
  errorBackground: "rgba(224, 138, 110, 0.12)",
};

function formatAmount(value: string | number): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "0.00";
  }

  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function MonthlyReportPage() {
  const router = useRouter();
  const params = useParams();

  const year = Number(params.year);
  const month = Number(params.month);

  const monthName = useMemo(() => {
    return MONTH_NAMES[month - 1] ?? `Month ${month}`;
  }, [month]);

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportMonthly | null>(null);
  const [closing, setClosing] = useState<MonthlyClosing | null>(null);
  const [loading, setLoading] = useState(true);
  const [closingLoading, setClosingLoading] = useState(false);
  const [savingClosing, setSavingClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closingError, setClosingError] = useState<string | null>(null);
  const [showClosingForm, setShowClosingForm] = useState(false);
  const [bankBalance, setBankBalance] = useState("");
  const [closingExpense, setClosingExpense] = useState("");

  useEffect(() => {
    const storedBusinessId = localStorage.getItem("business_id");

    if (!storedBusinessId) {
      router.replace("/businesses");
      return;
    }

    setBusinessId(storedBusinessId);
  }, [router]);

  const loadReport = useCallback(async () => {
    if (!businessId || !year || !month) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await sdk.reports.monthly(
        businessId,
        year,
        month,
      );

      setReport(data);
    } catch (err) {
      console.error("Failed to load monthly report:", err);
      setReport(null);
      setError("Couldn't load this monthly report. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [businessId, year, month]);

  const loadClosing = useCallback(async () => {
    if (!businessId || !year || !month) {
      return;
    }

    setClosingLoading(true);
    setClosingError(null);

    try {
      const data = await sdk.reports.getClosing(
        businessId,
        year,
        month,
      );

      setClosing(data);
      setBankBalance(data.bank_balance);
      setClosingExpense(data.closing_expense);
    } catch (err) {
  if (
    err instanceof Error &&
    err.message === "Monthly report has not been closed"
  ) {
    setClosing(null);
    setBankBalance("");
    setClosingExpense("");
  } else {
    console.error("Failed to load monthly closing:", err);
    setClosingError(
      err instanceof Error
        ? err.message
        : "Failed to load monthly closing.",
    );
    setClosing(null);
    setBankBalance("");
    setClosingExpense("");
  }
    } finally {
      setClosingLoading(false);
    }
  }, [businessId, year, month]);

  useEffect(() => {
    if (!businessId) {
      return;
    }

    void loadReport();
    void loadClosing();
  }, [businessId, loadReport, loadClosing]);

  const days = useMemo(() => {
    if (!report?.days) {
      return [];
    }

    return [...report.days].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  }, [report]);

  const isClosed = closing?.is_closed ?? report?.is_closed ?? false;

  const openClosingForm = () => {
    setClosingError(null);
    setBankBalance(closing?.bank_balance ?? "");
    setClosingExpense(closing?.closing_expense ?? "");
    setShowClosingForm(true);
  };

  const saveClosing = async () => {
    if (!businessId) {
      return;
    }

    const parsedBankBalance = Number(bankBalance);
    const parsedClosingExpense = Number(closingExpense);

    if (!Number.isFinite(parsedBankBalance)) {
      setClosingError("Enter a valid bank balance.");
      return;
    }

    if (!Number.isFinite(parsedClosingExpense)) {
      setClosingError("Enter a valid closing expense.");
      return;
    }

    setSavingClosing(true);
    setClosingError(null);

    try {
      const data = closing
        ? await sdk.reports.updateClosing(
            businessId,
            year,
            month,
            {
              bank_balance: parsedBankBalance.toFixed(2),
              closing_expense: parsedClosingExpense.toFixed(2),
            },
          )
        : await sdk.reports.closeMonth(
            businessId,
            year,
            month,
            {
              bank_balance: parsedBankBalance.toFixed(2),
              closing_expense: parsedClosingExpense.toFixed(2),
            },
          );

      setClosing(data);
      setBankBalance(data.bank_balance);
      setClosingExpense(data.closing_expense);
      setShowClosingForm(false);

      await loadReport();
    } catch (err) {
      console.error("Failed to save monthly closing:", err);
      setClosingError("Couldn't save the month closing. Please try again.");
    } finally {
      setSavingClosing(false);
    }
  };

  if (loading) {
    return (
      <main
        className="min-h-screen pb-28"
        style={{ backgroundColor: colors.background, color: colors.text }}
      >
        <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
          <div className="mb-6">
            <div
              className="h-4 w-24 animate-pulse rounded"
              style={{ backgroundColor: colors.surface }}
            />
            <div
              className="mt-4 h-8 w-56 animate-pulse rounded"
              style={{ backgroundColor: colors.surface }}
            />
            <div
              className="mt-2 h-4 w-40 animate-pulse rounded"
              style={{ backgroundColor: colors.surface }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg p-5"
                style={{
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div
                  className="h-4 w-24 animate-pulse rounded"
                  style={{ backgroundColor: colors.background }}
                />
                <div
                  className="mt-3 h-7 w-32 animate-pulse rounded"
                  style={{ backgroundColor: colors.background }}
                />
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg p-5"
                style={{
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div
                  className="h-5 w-36 animate-pulse rounded"
                  style={{ backgroundColor: colors.background }}
                />
                <div
                  className="mt-3 h-4 w-48 animate-pulse rounded"
                  style={{ backgroundColor: colors.background }}
                />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main
        className="min-h-screen pb-28"
        style={{ backgroundColor: colors.background, color: colors.text }}
      >
        <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
          <button
            type="button"
            onClick={() => router.push("/reports")}
            className="mb-6 inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
            style={{ color: colors.secondary }}
          >
            <span aria-hidden="true">←</span>
            Reports
          </button>

          <section
            className="rounded-lg p-8 text-center"
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl font-semibold"
              style={{
                backgroundColor: colors.errorBackground,
                color: colors.error,
              }}
            >
              !
            </div>

            <h1
              className="mt-4 text-base font-semibold"
              style={{ color: colors.text }}
            >
              Couldn&apos;t load this report
            </h1>

            <p
              className="mt-2 text-sm"
              style={{ color: colors.secondary }}
            >
              {error ?? "No report data is available."}
            </p>

            <button
              type="button"
              onClick={() => void loadReport()}
              className="mt-5 rounded-md px-5 py-2.5 text-sm font-semibold"
              style={{
                backgroundColor: colors.accent,
                color: colors.text,
              }}
            >
              Retry
            </button>
          </section>
        </div>
      </main>
    );
  }

  const pnlIsPositive = Number(closing?.pnl ?? 0) >= 0;

  return (
    <main
      className="min-h-screen pb-28"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.push("/reports")}
            className="mb-5 inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
            style={{ color: colors.secondary }}
          >
            <span aria-hidden="true">←</span>
            Reports
          </button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: colors.accent }}
              >
                Monthly report
              </p>

              <h1
                className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
                style={{ color: colors.text }}
              >
                {monthName} {year}
              </h1>

              <p
                className="mt-1 text-sm"
                style={{ color: colors.secondary }}
              >
                {report.days_available} days available
              </p>
            </div>

            {isClosed && (
              <span
                className="w-fit rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: colors.accentSoft,
                  color: colors.accent,
                }}
              >
                Month closed
              </span>
            )}
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2">
          {[
            ["Cash sales", report.total_cash_sales],
            ["Total expenses", report.total_expenses],
            ["Employee salary", report.total_employee_salary],
            ["Cash balance", report.cash_balance],
          ].map(([label, value]) => {
            const isBalance = label === "Cash balance";
            const isNegative = Number(value) < 0;

            return (
              <div
                key={label}
                className="rounded-lg p-5"
                style={{
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.15em]"
                  style={{ color: colors.secondary }}
                >
                  {label}
                </p>

                <p
                  className="mt-2 text-2xl font-bold tracking-tight"
                  style={{
                    color:
                      isBalance && isNegative
                        ? colors.error
                        : colors.text,
                  }}
                >
                  RM {formatAmount(value)}
                </p>
              </div>
            );
          })}
        </section>

        <section
          className="mt-5 rounded-lg p-5"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div className="mb-2">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.15em]"
              style={{ color: colors.secondary }}
            >
              Expense breakdown
            </p>

            <p
              className="mt-1 text-sm"
              style={{ color: colors.muted }}
            >
              Total expenses for {monthName}
            </p>
          </div>

          <div>
            {[
              ["General", report.total_general_expenses],
              ["Utility", report.total_utility_expenses],
              ["Other", report.total_other_expenses],
              ["Overtime", report.total_overtime],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b py-3"
                style={{ borderColor: colors.border }}
              >
                <span
                  className="text-sm"
                  style={{ color: colors.secondary }}
                >
                  {label}
                </span>

                <span
                  className="text-sm font-semibold"
                  style={{ color: colors.text }}
                >
                  RM {formatAmount(value)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section
          className="mt-5 overflow-hidden rounded-lg"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div
            className="flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-6"
            style={{ borderColor: colors.border }}
          >
            <div>
              <h2
                className="text-base font-semibold"
                style={{ color: colors.text }}
              >
                Daily breakdown
              </h2>

              <p
                className="mt-1 text-sm"
                style={{ color: colors.muted }}
              >
                Latest days first
              </p>
            </div>

            <span
              className="text-xs"
              style={{ color: colors.muted }}
            >
              {days.length} days
            </span>
          </div>

          {days.length > 0 ? (
            <div>
              {days.map((day, index) => {
                const dayBalanceNegative = Number(day.balance) < 0;

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/reports/${year}/${String(month).padStart(
                          2,
                          "0",
                        )}/${day.date}`,
                      )
                    }
                    className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-opacity hover:opacity-80 sm:px-6"
                    style={{
                      borderTop:
                        index === 0
                          ? "none"
                          : `1px solid ${colors.border}`,
                    }}
                  >
                    <div className="min-w-0">
                      <p
                        className="font-medium"
                        style={{ color: colors.text }}
                      >
                        {formatDay(day.date)}
                      </p>

                      <p
                        className="mt-1 text-xs"
                        style={{ color: colors.muted }}
                      >
                        {formatDate(day.date)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                      <div className="hidden text-right sm:block">
                        <p
                          className="text-xs"
                          style={{ color: colors.muted }}
                        >
                          Sales
                        </p>

                        <p
                          className="text-sm font-medium"
                          style={{ color: colors.secondary }}
                        >
                          RM {formatAmount(day.cash_sales)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p
                          className="text-xs"
                          style={{ color: colors.muted }}
                        >
                          Balance
                        </p>

                        <p
                          className="text-sm font-semibold"
                          style={{
                            color: dayBalanceNegative
                              ? colors.error
                              : colors.accent,
                          }}
                        >
                          RM {formatAmount(day.balance)}
                        </p>
                      </div>

                      <span
                        aria-hidden="true"
                        className="text-2xl transition-opacity group-hover:opacity-70"
                        style={{ color: colors.secondary }}
                      >
                        ›
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p
                className="text-sm"
                style={{ color: colors.secondary }}
              >
                No daily report data is available for this month.
              </p>
            </div>
          )}
        </section>

        <section
          className="mt-5 overflow-hidden rounded-lg"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div
            className="border-b px-5 py-4 sm:px-6"
            style={{ borderColor: colors.border }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  className="text-base font-semibold"
                  style={{ color: colors.text }}
                >
                  Month closing
                </h2>

                <p
                  className="mt-1 text-sm"
                  style={{ color: colors.muted }}
                >
                  Finalize the month with the bank balance and closing expense.
                </p>
              </div>

              {!closingLoading && (
                <button
                  type="button"
                  onClick={openClosingForm}
                  className="rounded-md px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: colors.accent,
                    color: colors.text,
                  }}
                >
                  {closing ? "Edit closing" : "Close month"}
                </button>
              )}
            </div>
          </div>

          {closingLoading ? (
            <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-lg p-4"
                  style={{
                    backgroundColor: colors.background,
                  }}
                >
                  <div
                    className="h-4 w-24 animate-pulse rounded"
                    style={{ backgroundColor: colors.surface }}
                  />
                  <div
                    className="mt-3 h-6 w-32 animate-pulse rounded"
                    style={{ backgroundColor: colors.surface }}
                  />
                </div>
              ))}
            </div>
          ) : closing ? (
            <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
              {[
                ["Cash balance", closing.cash_balance],
                ["Bank balance", closing.bank_balance],
                ["Closing expense", closing.closing_expense],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg p-4"
                  style={{ backgroundColor: colors.background }}
                >
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.15em]"
                    style={{ color: colors.secondary }}
                  >
                    {label}
                  </p>

                  <p
                    className="mt-2 text-lg font-bold"
                    style={{ color: colors.text }}
                  >
                    RM {formatAmount(value)}
                  </p>
                </div>
              ))}

              <div
                className="rounded-lg p-5 sm:col-span-3"
                style={{
                  backgroundColor: colors.background,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.15em]"
                  style={{ color: colors.secondary }}
                >
                  Total balance
                </p>

                <p
                  className="mt-2 text-2xl font-bold"
                  style={{
                    color:
                      Number(closing.total_balance) < 0
                        ? colors.error
                        : colors.accent,
                  }}
                >
                  RM {formatAmount(closing.total_balance)}
                </p>
              </div>

              <div
                className="rounded-lg p-5 sm:col-span-3"
                style={{
                  backgroundColor: pnlIsPositive
                    ? colors.accentSoft
                    : colors.errorBackground,
                  border: `1px solid ${
                    pnlIsPositive
                      ? "rgba(31, 122, 94, 0.3)"
                      : "rgba(224, 138, 110, 0.3)"
                  }`,
                }}
              >
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.15em]"
                  style={{
                    color: pnlIsPositive
                      ? colors.accent
                      : colors.error,
                  }}
                >
                  Final P&amp;L
                </p>

                <p
                  className="mt-2 text-3xl font-bold tracking-tight"
                  style={{
                    color: pnlIsPositive
                      ? colors.accent
                      : colors.error,
                  }}
                >
                  RM {formatAmount(closing.pnl)}
                </p>

                <p
                  className="mt-2 text-xs"
                  style={{ color: colors.secondary }}
                >
                  {pnlIsPositive
                    ? "The month finished with a positive profit."
                    : "The month finished with a negative profit."}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              <div
                className="rounded-lg p-5"
                style={{ backgroundColor: colors.background }}
              >
                <p
                  className="text-sm font-semibold"
                  style={{ color: colors.text }}
                >
                  This month has not been closed yet.
                </p>

                <p
                  className="mt-1 text-sm"
                  style={{ color: colors.secondary }}
                >
                  Add the bank balance and closing expense to finalize the
                  month and generate the final P&amp;L.
                </p>
              </div>
            </div>
          )}

          {showClosingForm && (
            <div
              className="border-t p-5 sm:p-6"
              style={{
                borderColor: colors.border,
                backgroundColor: colors.background,
              }}
            >
              <div className="mx-auto max-w-2xl">
                <div className="mb-5">
                  <h3
                    className="text-base font-semibold"
                    style={{ color: colors.text }}
                  >
                    {closing ? "Edit month closing" : "Close month"}
                  </h3>

                  <p
                    className="mt-1 text-sm"
                    style={{ color: colors.secondary }}
                  >
                    Enter the final month-end values.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: colors.text }}
                    >
                      Bank balance
                    </span>

                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={bankBalance}
                      onChange={(event) =>
                        setBankBalance(event.target.value)
                      }
                      placeholder="0.00"
                      className="mt-2 block min-h-12 w-full rounded-md border px-4 text-sm outline-none"
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.text,
                      }}
                    />
                  </label>

                  <label className="block">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: colors.text }}
                    >
                      Closing expense
                    </span>

                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={closingExpense}
                      onChange={(event) =>
                        setClosingExpense(event.target.value)
                      }
                      placeholder="0.00"
                      className="mt-2 block min-h-12 w-full rounded-md border px-4 text-sm outline-none"
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.text,
                      }}
                    />
                  </label>
                </div>

                {closingError && (
                  <div
                    className="mt-4 rounded-md px-4 py-3 text-sm"
                    style={{
                      backgroundColor: colors.errorBackground,
                      color: colors.error,
                    }}
                  >
                    {closingError}
                  </div>
                )}

                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowClosingForm(false);
                      setClosingError(null);
                    }}
                    disabled={savingClosing}
                    className="min-h-12 rounded-md border px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      borderColor: colors.border,
                      color: colors.text,
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void saveClosing()}
                    disabled={savingClosing}
                    className="min-h-12 rounded-md px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      backgroundColor: colors.accent,
                      color: colors.text,
                    }}
                  >
                    {savingClosing
                      ? "Saving..."
                      : closing
                        ? "Update closing"
                        : "Close month"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="mx-auto grid h-16 w-full max-w-3xl grid-cols-4">
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
              className="flex min-h-16 items-center justify-center text-[11px] font-semibold"
              style={{
                color: item.active
                  ? colors.accent
                  : colors.secondary,
              }}
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </main>
  );
}
