
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ReportDaily } from "@blacklane-ledger/sdk";

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

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      const data = await sdk.reports.daily(
        businessId,
        date,
      );

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

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const monthLabel = useMemo(() => {
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return "";
    }

    return formatMonthLabel(year, month);
  }, [year, month]);

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

  return (
    <main
      className="min-h-screen pb-24"
      style={{
        backgroundColor: colors.background,
        color: colors.text,
      }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
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
            Daily report
          </p>

          <h1
            className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ color: colors.text }}
          >
            {date ? formatFullDate(date) : "Daily report"}
          </h1>
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
              onClick={() => void loadReport()}
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
              className="h-32 animate-pulse rounded-lg"
              style={{ backgroundColor: colors.surface }}
            />
          </div>
        ) : report ? (
          <div className="space-y-5">
            {/* Cash sales */}
            <section
              className="rounded-lg p-5"
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
              }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: colors.secondary }}
              >
                Cash sales
              </p>

              <p
                className="mt-2 text-4xl font-bold tracking-tight"
                style={{ color: colors.text }}
              >
                RM {formatMoney(report.cash_sales)}
              </p>
            </section>

            {/* Expenses */}
            <section
              className="rounded-lg p-5"
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="mb-2">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: colors.secondary }}
                >
                  Expenses
                </p>
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
            </section>

            {/* Daily balance */}
            <section
              className="rounded-lg p-5"
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
              }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: colors.secondary }}
              >
                Daily operating balance
              </p>

              <p
                className="mt-2 text-4xl font-bold tracking-tight"
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
                Cash sales minus general expenses, utility expenses,
                other expenses, employee salary, and overtime.
              </p>
            </section>

            {/* Summary */}
            <section
              className="rounded-lg p-5"
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p
                    className="text-xs"
                    style={{ color: colors.secondary }}
                  >
                    Cash sales
                  </p>

                  <p
                    className="mt-1 text-sm font-semibold"
                    style={{ color: colors.text }}
                  >
                    RM {formatMoney(report.cash_sales)}
                  </p>
                </div>

                <div className="text-right">
                  <p
                    className="text-xs"
                    style={{ color: colors.secondary }}
                  >
                    Total expenses
                  </p>

                  <p
                    className="mt-1 text-sm font-semibold"
                    style={{ color: colors.text }}
                  >
                    RM {formatMoney(report.expenses.total)}
                  </p>
                </div>
              </div>
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
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
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
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium"
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

