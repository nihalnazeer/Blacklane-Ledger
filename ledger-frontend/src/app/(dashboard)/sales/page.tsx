"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Sale } from "@blacklane-ledger/sdk";

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
 * The brand sheet doesn't give hex values for the border, accent, or error
 * colors it uses visually (border is implied by contrast, the accent is the
 * deep green swatch next to the palette, and there's no error color at
 * all). Those three are best-guess approximations below — swap them for
 * exact values if you have them.
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
  error: "#E08A6E", // not in the brand sheet — kept from the previous build
  errorBackground: "rgba(224, 138, 110, 0.12)",
};

// ---------------------------------------------------------------------------
// Date / formatting helpers
// ---------------------------------------------------------------------------

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

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getDaysInMonth(monthStr: string): number {
  const [year, month] = monthStr.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function getMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

type DayRow = {
  date: string;
  dayNum: number;
  weekday: string;
  sale: Sale | null;
};

/**
 * Builds one row per day for the selected month, most recent first.
 * For the current month this stops at today (no point showing empty
 * future days); for past months it lists the full month.
 * A day with no matching record stays `sale: null` — the UI must render
 * that as "no entry", never as zero.
 */
function buildMonthRows(monthStr: string, sales: Sale[]): DayRow[] {
  const today = getToday();
  const isCurrentMonth = monthStr === getCurrentMonth();
  const lastDay = isCurrentMonth
    ? Number(today.slice(8, 10))
    : getDaysInMonth(monthStr);

  const [year, month] = monthStr.split("-").map(Number);
  const saleByDate = new Map(sales.map((sale) => [sale.sale_date, sale]));

  const rows: DayRow[] = [];

  for (let day = lastDay; day >= 1; day--) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(year, month - 1, day).toLocaleDateString("en-MY", {
      weekday: "short",
    });

    rows.push({
      date: dateStr,
      dayNum: day,
      weekday,
      sale: saleByDate.get(dateStr) ?? null,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Error handling helpers (section 18 of the spec)
// ---------------------------------------------------------------------------

function getErrorStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }

  const candidate = err as { status?: unknown; response?: { status?: unknown } };

  if (typeof candidate.status === "number") {
    return candidate.status;
  }

  if (typeof candidate.response?.status === "number") {
    return candidate.response.status;
  }

  return undefined;
}

function describeListError(err: unknown): { message: string; status?: number } {
  const status = getErrorStatus(err);

  if (status === 401) {
    return { message: "Your session has expired. Please sign in again.", status };
  }

  if (status === 404) {
    return { message: "Restaurant business not found.", status };
  }

  return {
    message: err instanceof Error ? err.message : "Unable to load sales.",
    status,
  };
}

function describeSaveError(err: unknown): { message: string; status?: number } {
  const status = getErrorStatus(err);

  if (status === 401) {
    return { message: "Your session has expired. Please sign in again.", status };
  }

  if (status === 409) {
    return {
      message: "A sales entry already exists for this date. You can edit it instead.",
      status,
    };
  }

  if (status === 422) {
    return {
      message: "That request wasn't valid — please check the business is selected correctly.",
      status,
    };
  }

  return {
    message: err instanceof Error ? err.message : "Unable to save the sale.",
    status,
  };
}

function describeDeleteError(err: unknown): { message: string; status?: number } {
  const status = getErrorStatus(err);

  if (status === 401) {
    return { message: "Your session has expired. Please sign in again.", status };
  }

  return {
    message: err instanceof Error ? err.message : "Unable to delete the sale.",
    status,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SalesPage() {
  const router = useRouter();

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [duplicateSale, setDuplicateSale] = useState<Sale | null>(null);

  const [saleDate, setSaleDate] = useState(getToday());
  const [cashIncome, setCashIncome] = useState("");
  const [atmTopup, setAtmTopup] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // -- Business id guard (section 19) --------------------------------------

  useEffect(() => {
    const storedBusinessId = localStorage.getItem("business_id");

    if (!storedBusinessId || storedBusinessId === "businessId") {
      router.replace("/businesses");
      return;
    }

    setBusinessId(storedBusinessId);
  }, [router]);

  // -- Load sales -----------------------------------------------------------

  useEffect(() => {
    if (!businessId) {
      return;
    }

    let cancelled = false;

    async function loadSales() {
      setIsLoading(true);
      setError(null);
      setSessionExpired(false);

      try {
        const result = await sdk.sales.list(businessId as string);

        if (!cancelled) {
          setSales(result);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        const { message, status } = describeListError(err);

        if (status === 404) {
          localStorage.removeItem("business_id");
          router.replace("/businesses");
          return;
        }

        if (status === 401) {
          setSessionExpired(true);
        }

        setError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSales();

    return () => {
      cancelled = true;
    };
  }, [businessId, router]);

  // -- Derived state ---------------------------------------------------------

  const today = getToday();
  const todaySale = useMemo(
    () => sales.find((sale) => sale.sale_date === today) ?? null,
    [sales, today],
  );

  const monthRows = useMemo(
    () => buildMonthRows(selectedMonth, sales),
    [selectedMonth, sales],
  );

  const monthSales = useMemo(
    () => sales.filter((sale) => sale.sale_date.startsWith(selectedMonth)),
    [sales, selectedMonth],
  );

  const monthlyCashIncome = useMemo(
    () => monthSales.reduce((total, sale) => total + Number(sale.cash_income) + Number(sale.atm_topup), 0),
    [monthSales],
  );

  const totalDaysInMonth = getDaysInMonth(selectedMonth);
  const monthLabel = getMonthLabel(selectedMonth);

  // -- Form handling ----------------------------------------------------------

  function openCreateForm(prefillDate?: string) {
    setEditingSale(null);
    setDuplicateSale(null);
    setSaleDate(prefillDate ?? getToday());
    setCashIncome("");
    setAtmTopup("");
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(sale: Sale) {
    setEditingSale(sale);
    setDuplicateSale(null);
    setSaleDate(sale.sale_date);
    setCashIncome(sale.cash_income);
    setAtmTopup(sale.atm_topup);
    setFormError(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSaving) {
      return;
    }

    setIsFormOpen(false);
    setEditingSale(null);
    setDuplicateSale(null);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!businessId) {
      setFormError("No business is selected.");
      return;
    }

    if (!saleDate) {
      setFormError("Please select a date.");
      return;
    }

    const cash = Number(cashIncome);
    const topup = atmTopup.trim() === "" ? 0 : Number(atmTopup);

    if (!Number.isFinite(cash) || cash < 0) {
      setFormError("Cash income must be zero or greater.");
      return;
    }

    if (!Number.isFinite(topup) || topup < 0) {
      setFormError("ATM top-up must be zero or greater.");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    setDuplicateSale(null);

    try {
      if (editingSale) {
        const updatedSale = await sdk.sales.update(businessId, editingSale.id, {
          sale_date: saleDate,
          cash_income: cash.toFixed(2),
          atm_topup: topup.toFixed(2),
        });

        setSales((current) =>
          current.map((sale) => (sale.id === updatedSale.id ? updatedSale : sale)),
        );
      } else {
        const newSale = await sdk.sales.create(businessId, {
  sale_date: saleDate,
  cash_income: cash.toFixed(2),
  atm_topup: topup.toFixed(2),
});

        setSales((current) => [...current, newSale]);
      }

      setSelectedMonth(saleDate.slice(0, 7));
      setIsFormOpen(false);
      setEditingSale(null);
    } catch (err) {
      const { message, status } = describeSaveError(err);

      if (status === 409) {
        const existing = sales.find((sale) => sale.sale_date === saleDate) ?? null;
        setDuplicateSale(existing);
      }

      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  }

  // -- Delete handling ---------------------------------------------------------

  function requestDelete(sale: Sale) {
    setDeleteTarget(sale);
  }

  function cancelDelete() {
    if (isDeleting) {
      return;
    }
    setDeleteTarget(null);
  }

  async function confirmDelete() {
    if (!businessId || !deleteTarget) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await sdk.sales.delete(businessId, deleteTarget.id);

      setSales((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);

      if (isFormOpen && editingSale?.id === deleteTarget.id) {
        setIsFormOpen(false);
        setEditingSale(null);
      }
    } catch (err) {
      const { message } = describeDeleteError(err);
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  }

  // -- Month navigation ---------------------------------------------------------

  function changeMonth(offset: number) {
    const [yearString, monthString] = selectedMonth.split("-");
    const date = new Date(Number(yearString), Number(monthString) - 1 + offset, 1);

    const nextYear = date.getFullYear();
    const nextMonth = String(date.getMonth() + 1).padStart(2, "0");

    setSelectedMonth(`${nextYear}-${nextMonth}`);
  }

  // -- Session ---------------------------------------------------------------

  function handleSignOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("business_id");
    router.replace("/login");
  }

  // ---------------------------------------------------------------------------

  return (
    <main
      className="min-h-screen pb-24"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Page title (spec section 5) */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: colors.accent }}
            >
              Restaurant bookkeeping
            </p>
            <h1
              className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ color: colors.text }}
            >
              Sales
            </h1>
            <p className="mt-1 text-sm" style={{ color: colors.secondary }}>
              {monthLabel}
            </p>
          </div>

          <button
            type="button"
            aria-label="More options"
            title="Export, settings, and help — coming soon"
            className="flex h-9 w-9 items-center justify-center rounded-md text-lg transition-opacity hover:opacity-70"
            style={{ color: colors.secondary }}
          >
            ⋯
          </button>
        </div>

        {sessionExpired ? (
          <div
            className="mb-4 flex items-center justify-between gap-3 rounded-md px-4 py-3 text-sm"
            style={{ backgroundColor: colors.errorBackground, color: colors.error }}
          >
            <span>Your session has expired. Please sign in again.</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: colors.error, color: colors.error }}
            >
              Sign in
            </button>
          </div>
        ) : (
          error &&
          !isFormOpen && (
            <div
              className="mb-4 rounded-md px-4 py-3 text-sm"
              style={{ backgroundColor: colors.errorBackground, color: colors.error }}
            >
              {error}
            </div>
          )
        )}

        {/* TODAY card (spec section 7) — always the actual current day */}
        <section
          className="mb-6 rounded-lg p-5"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: colors.secondary }}
          >
            Today
          </p>
          <p className="mt-1 text-sm font-medium" style={{ color: colors.text }}>
            {formatFullDate(today)}
          </p>

          {todaySale ? (
            <>
              <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
                <div>
                  <p className="text-xs" style={{ color: colors.secondary }}>
                    Cash income
                  </p>
                  <p
                    className="mt-1 text-3xl font-bold tracking-tight"
                    style={{ color: colors.text }}
                  >
                    RM {formatMoney(todaySale.cash_income)}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: colors.secondary }}>
                    ATM top-up
                  </p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: colors.secondary }}>
                    RM {formatMoney(todaySale.atm_topup)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openEditForm(todaySale)}
                className="mt-5 min-h-11 rounded-md px-5 text-sm font-semibold transition-opacity hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: colors.accentSoft, color: colors.accent }}
              >
                Edit today's sale
              </button>
            </>
          ) : (
            <>
              <p className="mt-4 text-sm" style={{ color: colors.secondary }}>
                No sales recorded yet.
              </p>

              <button
                type="button"
                onClick={() => openCreateForm(today)}
                className="mt-5 min-h-11 rounded-md px-5 text-sm font-semibold transition-opacity hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: colors.accent, color: colors.text }}
              >
                + Add today's sale
              </button>
            </>
          )}
        </section>

        {/* Month selector (spec section 6) */}
        <div className="mb-4 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-md text-lg transition-opacity hover:opacity-70"
            style={{ color: colors.text }}
          >
            ‹
          </button>

          <span
            className="min-w-[140px] text-center text-sm font-semibold"
            style={{ color: colors.text }}
          >
            {monthLabel}
          </span>

          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-md text-lg transition-opacity hover:opacity-70"
            style={{ color: colors.text }}
          >
            ›
          </button>
        </div>

        {/* Monthly summary (spec section 12) */}
        <section
          className="mb-5 rounded-lg p-5"
          style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs" style={{ color: colors.secondary }}>
                Cash total
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight" style={{ color: colors.text }}>
                RM {formatMoney(monthlyCashIncome)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs" style={{ color: colors.secondary }}>
                Recorded
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight" style={{ color: colors.text }}>
                {monthSales.length}
                <span className="text-base font-medium" style={{ color: colors.secondary }}>
                  {" "}
                  / {totalDaysInMonth}
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Duplicate-entry banner (spec section 9 / 409 handling) */}
        {duplicateSale && !isFormOpen && (
          <div
            className="mb-4 flex items-center justify-between gap-3 rounded-md px-4 py-3 text-sm"
            style={{ backgroundColor: colors.errorBackground, color: colors.error }}
          >
            <span>A sales entry already exists for {formatFullDate(duplicateSale.sale_date)}.</span>
            <button
              type="button"
              onClick={() => openEditForm(duplicateSale)}
              className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: colors.error, color: colors.error }}
            >
              View entry
            </button>
          </div>
        )}

        {/* Daily history (spec sections 10 & 11 — missing days shown as "—", never zero) */}
        {isLoading ? (
          <section
            className="space-y-px overflow-hidden rounded-lg"
            style={{ border: `1px solid ${colors.border}` }}
          >
            <div className="h-14 animate-pulse" style={{ backgroundColor: colors.surface }} />
            <div className="h-14 animate-pulse" style={{ backgroundColor: colors.surface }} />
            <div className="h-14 animate-pulse" style={{ backgroundColor: colors.surface }} />
          </section>
        ) : monthRows.length === 0 ? (
          <section
            className="rounded-lg border border-dashed px-5 py-12 text-center"
            style={{ borderColor: colors.border }}
          >
            <p className="text-sm" style={{ color: colors.secondary }}>
              Nothing to show for this month yet.
            </p>
          </section>
        ) : (
          <section
            className="overflow-hidden rounded-lg"
            style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.surface }}
          >
            {monthRows.map((row, index) => (
              <button
                key={row.date}
                type="button"
                onClick={() =>
                  row.sale ? openEditForm(row.sale) : openCreateForm(row.date)
                }
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-opacity hover:opacity-80"
                style={{
                  borderTop: index === 0 ? "none" : `1px solid ${colors.border}`,
                }}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold" style={{ color: colors.text }}>
                    {row.dayNum}
                  </span>
                  <span className="text-xs" style={{ color: colors.secondary }}>
                    {row.weekday}
                  </span>
                </div>

                {row.sale ? (
                  <span className="text-sm font-bold" style={{ color: colors.text }}>
                    RM {formatMoney(Number(row.sale.cash_income) + Number(row.sale.atm_topup))}
                  </span>
                ) : (
                  <span className="text-sm" style={{ color: colors.muted }}>
                    — no entry
                  </span>
                )}
              </button>
            ))}
          </section>
        )}
      </div>

      {/* Floating action button — reachable with one thumb (spec section 23) */}
      <button
        type="button"
        onClick={() => openCreateForm()}
        aria-label="Add sale"
        className="fixed bottom-20 right-5 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-semibold shadow-lg transition-opacity hover:opacity-90 active:scale-[0.96] sm:right-8"
        style={{ backgroundColor: colors.accent, color: colors.text }}
      >
        +
      </button>

      {/* Bottom navigation (spec section 23) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t md:hidden"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        {[
          { label: "Dashboard", href: "/dashboard", active: false },
          { label: "Sales", href: "/sales", active: true },
          { label: "Expenses", href: "/expenses", active: false },
          { label: "More", href: "/more", active: false },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium"
            style={{ color: item.active ? colors.accent : colors.secondary }}
          >
            {item.label}
          </a>
        ))}
      </nav>

      {/* Add / edit sale modal (spec sections 8, 9, 15, 16) */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          style={{ backgroundColor: "rgba(11,15,20,0.7)" }}
        >
          <div
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-lg p-5 shadow-2xl sm:max-w-md sm:rounded-lg sm:p-6"
            style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold" style={{ color: colors.text }}>
                  {editingSale ? "Edit sale" : "Add sale"}
                </h2>
                <p className="mt-1 text-sm" style={{ color: colors.secondary }}>
                  Cash sales and ATM top-ups are recorded separately, while the
                  daily cash total combines both.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="flex h-10 w-10 items-center justify-center rounded-md text-xl transition-opacity hover:opacity-70"
                style={{ color: colors.secondary }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold" style={{ color: colors.text }}>
                  Date
                </span>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(event) => setSaleDate(event.target.value)}
                  className="min-h-12 w-full rounded-md border px-4 text-base outline-none"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold" style={{ color: colors.text }}>
                  Cash sales
                </span>
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium"
                    style={{ color: colors.muted }}
                  >
                    RM
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={cashIncome}
                    onChange={(event) => setCashIncome(event.target.value)}
                    placeholder="0.00"
                    className="min-h-12 w-full rounded-md border pl-12 pr-4 text-base outline-none"
                    style={{
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    }}

                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold" style={{ color: colors.secondary }}>
                  ATM top-up
                </span>
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium"
                    style={{ color: colors.muted }}
                  >
                    RM
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={atmTopup}
                    onChange={(event) => setAtmTopup(event.target.value)}
                    placeholder="0.00"
                    className="min-h-12 w-full rounded-md border pl-12 pr-4 text-base outline-none"
                    style={{
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    }}
                    required
                  />
                </div>
              </label>

              {formError && (
                <div
                  className="rounded-md px-4 py-3 text-sm"
                  style={{ backgroundColor: colors.errorBackground, color: colors.error }}
                >
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSaving}
                  className="min-h-12 flex-1 rounded-md border px-4 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ borderColor: colors.border, color: colors.text }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-12 flex-1 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: colors.accent, color: colors.text }}
                >
                  {isSaving ? "Saving..." : editingSale ? "Save changes" : "Add sale"}
                </button>
              </div>

              {editingSale && (
                <button
                  type="button"
                  onClick={() => requestDelete(editingSale)}
                  disabled={isSaving}
                  className="w-full pt-1 text-center text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ color: colors.error }}
                >
                  Delete sale
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation (spec section 16) */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(11,15,20,0.75)" }}
        >
          <div
            className="w-full max-w-sm rounded-lg p-5 shadow-2xl"
            style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}` }}
          >
            <h2 className="text-lg font-bold" style={{ color: colors.text }}>
              Delete this sales entry?
            </h2>

            <p className="mt-3 text-sm" style={{ color: colors.text }}>
              {formatFullDate(deleteTarget.sale_date)}
            </p>
            <p className="mt-1 text-sm" style={{ color: colors.secondary }}>
              Cash total: RM {formatMoney(Number(deleteTarget.cash_income) + Number(deleteTarget.atm_topup))}
            </p>

            <p className="mt-3 text-xs" style={{ color: colors.muted }}>
              This cannot be undone.
            </p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                disabled={isDeleting}
                className="min-h-11 flex-1 rounded-md border px-4 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: colors.border, color: colors.text }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="min-h-11 flex-1 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: colors.error, color: colors.background }}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}