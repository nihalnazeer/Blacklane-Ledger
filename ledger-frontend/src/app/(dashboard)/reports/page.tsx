"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sdk } from "@/lib/api";
import type { ReportMonth, ReportYear } from "@blacklane-ledger/sdk";

/**
 * Brand palette — same source/approximations as Login, Sales, Expenses,
 * and Employees. Keep all files in sync if exact hex values change.
 */
const colors = {
  background: "#0B0F14",
  surface: "#1F2937",
  border: "rgba(156, 163, 175, 0.16)",
  text: "#FAFAFA",
  secondary: "#9CA3AF",
  muted: "#6B7280",
  accent: "#1F7A5C",
  accentSoft: "rgba(31, 122, 92, 0.14)",
  accentBorder: "rgba(31, 122, 92, 0.5)",
  error: "#E08A6E",
  errorBackground: "rgba(224, 138, 110, 0.12)",
};

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

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function isFutureMonth(year: number, month: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return year > currentYear || (year === currentYear && month > currentMonth);
}

function getMonthName(month: ReportMonth): string {
  return month.name || MONTH_NAMES[month.month - 1] || `Month ${month.month}`;
}

export default function ReportsPage() {
  const router = useRouter();

  const currentYear = useMemo(() => getCurrentYear(), []);

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [report, setReport] = useState<ReportYear | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tracks the most recently issued request so a slow, stale response
  // can't overwrite state after a newer request has already resolved.
  const latestRequestId = useRef(0);

  useEffect(() => {
    const storedBusinessId = localStorage.getItem("business_id");

    if (!storedBusinessId) {
      setLoading(false);
      router.replace("/businesses");
      return;
    }

    setBusinessId(storedBusinessId);
  }, [router]);

  const loadReport = useCallback(async () => {
    if (!businessId) {
      return;
    }

    const requestId = ++latestRequestId.current;

    setLoading(true);
    setError(null);

    try {
      const data = await sdk.reports.year(businessId, selectedYear);

      if (requestId !== latestRequestId.current) {
        return;
      }

      setReport(data);
    } catch (err) {
      if (requestId !== latestRequestId.current) {
        return;
      }

      console.error("Failed to load yearly report:", err);
      setReport(null);
      setError("Couldn't load this report. Please try again.");
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  }, [businessId, selectedYear]);

  useEffect(() => {
    if (!businessId) {
      return;
    }

    void loadReport();
  }, [businessId, loadReport]);

  const months = useMemo<ReportMonth[]>(() => {
    if (!report?.months) {
      return [];
    }

    // Most recent month first — consistent with the daily/employee views.
    return [...report.months].sort((a, b) => b.month - a.month);
  }, [report]);

  const availableMonthCount = useMemo(() => {
    return months.filter((month) => !isFutureMonth(month.year, month.month))
      .length;
  }, [months]);

  const goToPreviousYear = () => {
    setSelectedYear((year) => year - 1);
  };

  const goToNextYear = () => {
    if (selectedYear < currentYear) {
      setSelectedYear((year) => year + 1);
    }
  };

  const goToCurrentYear = () => {
    setSelectedYear(currentYear);
  };

  const openMonth = (month: ReportMonth) => {
    if (isFutureMonth(month.year, month.month)) {
      return;
    }

    router.push(
      `/reports/${month.year}/${String(month.month).padStart(2, "0")}`,
    );
  };

  return (
    <main
      className="min-h-dvh"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      <div
        className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8"
        style={{
          paddingTop: "1.5rem",
          // Clears the mobile bottom nav bar (~64px) plus the device's
          // own home-indicator safe area, so the last row of month
          // cards is never hidden underneath it.
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)",
        }}
      >
        {/* Header */}
        <header className="mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-5 flex items-center gap-2 text-sm transition hover:opacity-80"
            style={{ color: colors.secondary }}
          >
            <span aria-hidden="true">←</span>
            Reports
          </button>

          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>

          <p className="mt-2 text-sm" style={{ color: colors.secondary }}>
            View your business financial reports
          </p>
        </header>

        {/* Year navigation */}
        <section
          className="mb-6 rounded-2xl p-4"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={goToPreviousYear}
              aria-label="Previous year"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl transition hover:opacity-80"
              style={{
                border: `1px solid ${colors.border}`,
                color: colors.text,
                backgroundColor: colors.background,
              }}
            >
              ‹
            </button>

            <div className="text-center">
              <p
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: colors.muted }}
              >
                Year
              </p>

              <p className="mt-1 text-2xl font-semibold">{selectedYear}</p>

              {selectedYear !== currentYear && (
                <button
                  type="button"
                  onClick={goToCurrentYear}
                  className="mt-1 text-xs underline-offset-2 transition hover:underline"
                  style={{ color: colors.accent }}
                >
                  Back to {currentYear}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={goToNextYear}
              disabled={selectedYear >= currentYear}
              aria-label="Next year"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
              style={{
                border: `1px solid ${colors.border}`,
                color: colors.text,
                backgroundColor: colors.background,
              }}
            >
              ›
            </button>
          </div>
        </section>

        {/* Loading */}
        {loading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl p-5"
                style={{
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div
                  className="h-4 w-24 animate-pulse rounded"
                  style={{ backgroundColor: colors.border }}
                />
                <div
                  className="mt-3 h-3 w-32 animate-pulse rounded"
                  style={{ backgroundColor: colors.border }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <section
            className="rounded-2xl p-8 text-center"
            style={{
              backgroundColor: colors.errorBackground,
              border: `1px solid rgba(224, 138, 110, 0.35)`,
            }}
          >
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl font-semibold"
              style={{
                border: `1px solid rgba(224, 138, 110, 0.5)`,
                color: colors.error,
              }}
            >
              !
            </div>

            <h2 className="mt-4 text-base font-semibold">
              Couldn&apos;t load this report
            </h2>

            <p className="mt-2 text-sm" style={{ color: colors.secondary }}>
              Please try again.
            </p>

            <button
              type="button"
              onClick={() => void loadReport()}
              className="mt-5 rounded-xl px-5 py-2.5 text-sm font-medium transition hover:opacity-90"
              style={{ backgroundColor: colors.accent, color: colors.text }}
            >
              Retry
            </button>
          </section>
        )}

        {/* Report */}
        {!loading && !error && report && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: colors.secondary }}
              >
                Months
              </h2>

              <span className="text-xs" style={{ color: colors.muted }}>
                {availableMonthCount} available
              </span>
            </div>

            {months.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {months.map((month) => {
                  const future = isFutureMonth(month.year, month.month);

                  return (
                    <button
                      key={`${month.year}-${month.month}`}
                      type="button"
                      disabled={future}
                      onClick={() => openMonth(month)}
                      className={`group w-full rounded-2xl p-5 text-left transition ${
                        future ? "cursor-not-allowed opacity-40" : ""
                      }`}
                      style={{
                        backgroundColor: month.is_current
                          ? colors.accentSoft
                          : colors.surface,
                        border: `1px solid ${
                          month.is_current
                            ? colors.accentBorder
                            : colors.border
                        }`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-medium">
                              {getMonthName(month)}
                            </h3>

                            {month.is_current && (
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                                style={{
                                  border: `1px solid ${colors.accentBorder}`,
                                  backgroundColor: colors.accentSoft,
                                  color: colors.accent,
                                }}
                              >
                                Current
                              </span>
                            )}

                            {month.is_closed && (
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                                style={{
                                  border: `1px solid ${colors.border}`,
                                  color: colors.secondary,
                                }}
                              >
                                Closed
                              </span>
                            )}

                            {!month.is_closed && !future && (
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                                style={{
                                  border: `1px solid rgba(224, 184, 110, 0.35)`,
                                  backgroundColor: "rgba(224, 184, 110, 0.08)",
                                  color: "#D8B477",
                                }}
                              >
                                Review needed
                              </span>
                            )}

                            {future && (
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                                style={{
                                  border: `1px solid ${colors.border}`,
                                  color: colors.muted,
                                }}
                              >
                                Future
                              </span>
                            )}
                          </div>

                          <p
                            className="mt-2 text-xs"
                            style={{ color: colors.muted }}
                          >
                            {future
                              ? "No financial activity available yet"
                              : month.is_closed
                                ? month.is_current
                                  ? `Through day ${month.days_available}`
                                  : `${month.days_available} days available`
                                : month.is_current
                                  ? `Through day ${month.days_available} · Review needed`
                                  : `${month.days_available} days available · Review needed`}
                          </p>
                        </div>

                        {!future && (
                          <span
                            aria-hidden="true"
                            className="shrink-0 text-xl transition"
                            style={{ color: colors.muted }}
                          >
                            ›
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div
                className="rounded-2xl p-8 text-center"
                style={{
                  border: `1px dashed ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                <p className="text-sm font-medium">No report data</p>

                <p className="mt-2 text-xs" style={{ color: colors.muted }}>
                  There are no report periods available for {selectedYear}.
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}