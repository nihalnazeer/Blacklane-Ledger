"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { sdk } from "@/lib/api";

type ExpenseType = "general" | "utility" | "other";

interface Expense {
  id: string;
  business_id: string;
  expense_date: string;
  amount: string;
  description: string;
  expense_type: ExpenseType;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Brand palette — same source and same approximations as the Sales page:
 * border, accent, and error aren't given exact hex values on the brand
 * sheet, so those three are best-guess. Keep these two files in sync if
 * you get exact values later.
 */
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

// ---------------------------------------------------------------------------
// Helpers
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
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getToday(): string {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

function shiftDate(dateStr: string, offsetDays: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day + offsetDays);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getErrorStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }

  const candidate = err as {
    status?: unknown;
    response?: { status?: unknown };
  };

  if (typeof candidate.status === "number") {
    return candidate.status;
  }

  if (typeof candidate.response?.status === "number") {
    return candidate.response.status;
  }

  return undefined;
}

function describeListError(
  err: unknown,
): { message: string; status?: number } {
  const status = getErrorStatus(err);

  if (status === 401) {
    return {
      message: "Your session has expired. Please sign in again.",
      status,
    };
  }

  if (status === 404) {
    return {
      message: "Restaurant business not found.",
      status,
    };
  }

  return {
    message:
      err instanceof Error ? err.message : "Unable to load expenses.",
    status,
  };
}

function describeSaveError(
  err: unknown,
): { message: string; status?: number } {
  const status = getErrorStatus(err);

  if (status === 401) {
    return {
      message: "Your session has expired. Please sign in again.",
      status,
    };
  }

  if (status === 422) {
    return {
      message:
        "That request wasn't valid — please check the expense details.",
      status,
    };
  }

  return {
    message:
      err instanceof Error ? err.message : "Unable to save the expense.",
    status,
  };
}

function describeDeleteError(
  err: unknown,
): { message: string; status?: number } {
  const status = getErrorStatus(err);

  if (status === 401) {
    return {
      message: "Your session has expired. Please sign in again.",
      status,
    };
  }

  return {
    message:
      err instanceof Error ? err.message : "Unable to delete the expense.",
    status,
  };
}

function formatExpenseType(type: ExpenseType): string {
  switch (type) {
    case "utility":
      return "Utility";
    case "other":
      return "Other";
    default:
      return "General";
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExpensesPage() {
  const router = useRouter();

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedDate, setSelectedDate] = useState(getToday());

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseType, setExpenseType] =
    useState<ExpenseType>("general");
  const [note, setNote] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // -- Business id guard ------------------------------------------------------

  useEffect(() => {
    const storedBusinessId = localStorage.getItem("business_id");

    if (!storedBusinessId || storedBusinessId === "businessId") {
      router.replace("/businesses");
      return;
    }

    setBusinessId(storedBusinessId);
  }, [router]);

  // -- Load expenses -----------------------------------------------------------

  useEffect(() => {
  if (!businessId) {
    return;
  }

  const currentBusinessId = businessId;
  let cancelled = false;

  async function loadExpenses() {
    setIsLoading(true);
    setError(null);
    setSessionExpired(false);

    try {
      const result = await sdk.expenses.list(currentBusinessId);

      if (!cancelled) {
        setExpenses(result);
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

  void loadExpenses();

  return () => {
    cancelled = true;
  };
}, [businessId, router]);

  // -- Derived state -----------------------------------------------------------

  // Every expense for the selected date — there is no limit on how many
  // entries a date can have, so this can grow to any length.
  const dayExpenses = useMemo(
    () =>
      expenses
        .filter((expense) => expense.expense_date === selectedDate)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [expenses, selectedDate],
  );

  const dailyTotal = useMemo(
    () =>
      dayExpenses.reduce(
        (total, expense) => total + Number(expense.amount),
        0,
      ),
    [dayExpenses],
  );

  // Monthly aggregate — tracks whatever month `selectedDate` falls in.
  const monthKey = selectedDate.slice(0, 7);

  const monthExpenses = useMemo(
    () =>
      expenses.filter((expense) =>
        expense.expense_date.startsWith(monthKey),
      ),
    [expenses, monthKey],
  );

  const monthlyTotal = useMemo(
    () =>
      monthExpenses.reduce(
        (total, expense) => total + Number(expense.amount),
        0,
      ),
    [monthExpenses],
  );

  // -- Form handling -----------------------------------------------------------

  function openCreateForm() {
    setEditingExpense(null);
    setAmount("");
    setDescription("");
    setExpenseType("general");
    setNote("");
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(expense: Expense) {
    setEditingExpense(expense);
    setAmount(expense.amount);
    setDescription(expense.description);
    setExpenseType(expense.expense_type);
    setNote(expense.note ?? "");
    setFormError(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSaving) {
      return;
    }

    setIsFormOpen(false);
    setEditingExpense(null);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!businessId) {
      setFormError("No business is selected.");
      return;
    }

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError("Enter an amount greater than zero.");
      return;
    }

    if (!description.trim()) {
      setFormError("Enter a description for this expense.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingExpense) {
        const updatedExpense = await sdk.expenses.update(
          businessId,
          editingExpense.id,
          {
            expense_date: selectedDate,
            amount: parsedAmount.toFixed(2),
            description: description.trim(),
            expense_type: expenseType,
            note: note.trim() || null,
          },
        );

        setExpenses((current) =>
          current.map((expense) =>
            expense.id === updatedExpense.id
              ? updatedExpense
              : expense,
          ),
        );
      } else {
        // Always creates a new, independent record — a date can hold as
        // many expense entries as needed.
        const newExpense = await sdk.expenses.create(businessId, {
          expense_date: selectedDate,
          amount: parsedAmount.toFixed(2),
          description: description.trim(),
          expense_type: expenseType,
          note: note.trim() || null,
        });

        setExpenses((current) => [...current, newExpense]);
      }

      setIsFormOpen(false);
      setEditingExpense(null);
    } catch (err) {
      const { message } = describeSaveError(err);
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  }

  // -- Delete handling ---------------------------------------------------------

  function requestDelete(expense: Expense) {
    setDeleteTarget(expense);
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
      await sdk.expenses.delete(businessId, deleteTarget.id);

      setExpenses((current) =>
        current.filter((item) => item.id !== deleteTarget.id),
      );
      setDeleteTarget(null);

      if (
        isFormOpen &&
        editingExpense?.id === deleteTarget.id
      ) {
        setIsFormOpen(false);
        setEditingExpense(null);
      }
    } catch (err) {
      const { message } = describeDeleteError(err);
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  }

  // -- Date navigation ---------------------------------------------------------

  function changeDay(offset: number) {
    setSelectedDate((current) => shiftDate(current, offset));
  }

  // -- Session ----------------------------------------------------------------

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
      style={{
        backgroundColor: colors.background,
        color: colors.text,
      }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Page title */}
        <div className="mb-6">
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
            Expenses
          </h1>

          <p
            className="mt-1 text-sm"
            style={{ color: colors.secondary }}
          >
            Daily spend, one entry at a time
          </p>
        </div>

        {sessionExpired ? (
          <div
            className="mb-4 flex items-center justify-between gap-3 rounded-md px-4 py-3 text-sm"
            style={{
              backgroundColor: colors.errorBackground,
              color: colors.error,
            }}
          >
            <span>
              Your session has expired. Please sign in again.
            </span>

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
        ) : (
          error &&
          !isFormOpen && (
            <div
              className="mb-4 rounded-md px-4 py-3 text-sm"
              style={{
                backgroundColor: colors.errorBackground,
                color: colors.error,
              }}
            >
              {error}
            </div>
          )
        )}

        {/* Day selector */}
        <div className="mb-4 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => changeDay(-1)}
            aria-label="Previous day"
            className="flex h-9 w-9 items-center justify-center rounded-md text-lg transition-opacity hover:opacity-70"
            style={{ color: colors.text }}
          >
            ‹
          </button>

          <label
            className="relative flex min-w-[200px] cursor-pointer items-center justify-center rounded-md px-3 py-1.5 text-center text-sm font-semibold"
            style={{
              color: colors.text,
              backgroundColor: colors.surface,
            }}
          >
            {formatFullDate(selectedDate)}

            <input
              type="date"
              value={selectedDate}
              onChange={(event) =>
                event.target.value &&
                setSelectedDate(event.target.value)
              }
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Choose date"
            />
          </label>

          <button
            type="button"
            onClick={() => changeDay(1)}
            aria-label="Next day"
            className="flex h-9 w-9 items-center justify-center rounded-md text-lg transition-opacity hover:opacity-70"
            style={{ color: colors.text }}
          >
            ›
          </button>
        </div>

        {selectedDate !== getToday() && (
          <div className="mb-4 text-center">
            <button
              type="button"
              onClick={() => setSelectedDate(getToday())}
              className="text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: colors.accent }}
            >
              Jump to today
            </button>
          </div>
        )}

        {/* Daily summary */}
        <section
          className="mb-5 rounded-lg p-5"
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
                Total spent
              </p>

              <p
                className="mt-1 text-3xl font-bold tracking-tight"
                style={{ color: colors.text }}
              >
                RM {formatMoney(dailyTotal)}
              </p>
            </div>

            <div className="text-right">
              <p
                className="text-xs"
                style={{ color: colors.secondary }}
              >
                Entries
              </p>

              <p
                className="mt-1 text-2xl font-bold tracking-tight"
                style={{ color: colors.text }}
              >
                {dayExpenses.length}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="mt-5 min-h-11 w-full rounded-md px-5 text-sm font-semibold transition-opacity hover:opacity-90 active:scale-[0.98]"
            style={{
              backgroundColor: colors.accent,
              color: colors.text,
            }}
          >
            + Add expense
          </button>
        </section>

        {/* Monthly aggregate */}
        <section
          className="mb-5 flex items-center justify-between gap-4 rounded-lg px-5 py-4"
          style={{
            backgroundColor: "transparent",
            border: `1px solid ${colors.border}`,
          }}
        >
          <div>
            <p
              className="text-xs"
              style={{ color: colors.secondary }}
            >
              {getMonthLabel(monthKey)}
            </p>

            <p
              className="mt-1 text-sm"
              style={{ color: colors.muted }}
            >
              {monthExpenses.length}{" "}
              {monthExpenses.length === 1
                ? "entry"
                : "entries"}{" "}
              this month
            </p>
          </div>

          <p
            className="text-lg font-bold"
            style={{ color: colors.text }}
          >
            RM {formatMoney(monthlyTotal)}
          </p>
        </section>

        {/* Entries for selected date */}
        {isLoading ? (
          <section
            className="space-y-px overflow-hidden rounded-lg"
            style={{ border: `1px solid ${colors.border}` }}
          >
            <div
              className="h-16 animate-pulse"
              style={{ backgroundColor: colors.surface }}
            />
            <div
              className="h-16 animate-pulse"
              style={{ backgroundColor: colors.surface }}
            />
            <div
              className="h-16 animate-pulse"
              style={{ backgroundColor: colors.surface }}
            />
          </section>
        ) : dayExpenses.length === 0 ? (
          <section
            className="rounded-lg border border-dashed px-5 py-12 text-center"
            style={{ borderColor: colors.border }}
          >
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border text-2xl"
              style={{
                borderColor: colors.border,
                color: colors.accent,
              }}
            >
              $
            </div>

            <h2
              className="mt-4 text-lg font-semibold"
              style={{ color: colors.text }}
            >
              No expenses recorded
            </h2>

            <p
              className="mx-auto mt-2 max-w-sm text-sm leading-6"
              style={{ color: colors.secondary }}
            >
              Add every expense for this date — there&apos;s no
              limit on how many you can log.
            </p>

            <button
              type="button"
              onClick={openCreateForm}
              className="mt-5 min-h-12 rounded-md px-5 text-sm font-semibold transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{
                backgroundColor: colors.accent,
                color: colors.text,
              }}
            >
              Add first expense
            </button>
          </section>
        ) : (
          <section
            className="overflow-hidden rounded-lg"
            style={{
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
            }}
          >
            {dayExpenses.map((expense, index) => (
              <div
                key={expense.id}
                className="flex items-center justify-between gap-3 px-4 py-3.5"
                style={{
                  borderTop:
                    index === 0
                      ? "none"
                      : `1px solid ${colors.border}`,
                }}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: colors.text }}
                    >
                      {expense.description}
                    </p>

                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        color: colors.accent,
                        backgroundColor: colors.accentSoft,
                      }}
                    >
                      {formatExpenseType(expense.expense_type)}
                    </span>
                  </div>

                  {expense.note && (
                    <p
                      className="mt-0.5 truncate text-xs"
                      style={{ color: colors.secondary }}
                    >
                      {expense.note}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <p
                    className="text-sm font-bold"
                    style={{ color: colors.text }}
                  >
                    RM {formatMoney(expense.amount)}
                  </p>

                  <button
                    type="button"
                    onClick={() => openEditForm(expense)}
                    aria-label="Edit entry"
                    className="flex h-8 w-8 items-center justify-center rounded-md transition-opacity hover:opacity-70"
                    style={{ color: colors.secondary }}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => requestDelete(expense)}
                    aria-label="Delete entry"
                    className="flex h-8 w-8 items-center justify-center rounded-md transition-opacity hover:opacity-70"
                    style={{ color: colors.error }}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-.8 12.2A2 2 0 0 1 15.2 21H8.8a2 2 0 0 1-2-1.8L6 7"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      {/* Floating action button */}
      <button
        type="button"
        onClick={openCreateForm}
        aria-label="Add expense"
        className="fixed bottom-20 right-5 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-semibold shadow-lg transition-opacity hover:opacity-90 active:scale-[0.96] sm:right-8"
        style={{
          backgroundColor: colors.accent,
          color: colors.text,
        }}
      >
        +
      </button>

      {/* Bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t md:hidden"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
      >
        {[
          { label: "Dashboard", href: "/dashboard", active: false },
          { label: "Sales", href: "/sales", active: false },
          { label: "Expenses", href: "/expenses", active: true },
          { label: "More", href: "/more", active: false },
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

      {/* Add / edit expense modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          style={{ backgroundColor: "rgba(11,15,20,0.7)" }}
        >
          <div
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-lg p-5 shadow-2xl sm:max-w-md sm:rounded-lg sm:p-6"
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2
                  className="text-xl font-bold"
                  style={{ color: colors.text }}
                >
                  {editingExpense
                    ? "Edit expense"
                    : "Add expense"}
                </h2>

                <p
                  className="mt-1 text-sm"
                  style={{ color: colors.secondary }}
                >
                  {formatFullDate(selectedDate)}
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

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <label className="block">
                <span
                  className="mb-2 block text-sm font-semibold"
                  style={{ color: colors.text }}
                >
                  Amount
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
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) =>
                      setAmount(event.target.value)
                    }
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

              <label className="block">
                <span
                  className="mb-2 block text-sm font-semibold"
                  style={{ color: colors.text }}
                >
                  Description
                </span>

                <input
                  type="text"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="e.g. Vegetables"
                  maxLength={200}
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
                <span
                  className="mb-2 block text-sm font-semibold"
                  style={{ color: colors.text }}
                >
                  Expense type
                </span>

                <select
                  value={expenseType}
                  onChange={(event) =>
                    setExpenseType(
                      event.target.value as ExpenseType,
                    )
                  }
                  className="min-h-12 w-full rounded-md border px-4 text-base outline-none"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                >
                  <option value="general">General</option>
                  <option value="utility">Utility</option>
                  <option value="other">Other</option>
                </select>

                <p
                  className="mt-1.5 text-xs"
                  style={{ color: colors.muted }}
                >
                  This category is used in monthly reports.
                </p>
              </label>

              <label className="block">
                <span
                  className="mb-2 block text-sm font-semibold"
                  style={{ color: colors.secondary }}
                >
                  Note
                  <span
                    className="ml-1 font-normal"
                    style={{ color: colors.muted }}
                  >
                    (optional)
                  </span>
                </span>

                <textarea
                  value={note}
                  onChange={(event) =>
                    setNote(event.target.value)
                  }
                  placeholder="Optional details"
                  rows={3}
                  className="w-full rounded-md border px-4 py-3 text-base outline-none"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                />
              </label>

              {formError && (
                <div
                  className="rounded-md px-4 py-3 text-sm"
                  style={{
                    backgroundColor: colors.errorBackground,
                    color: colors.error,
                  }}
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
                  style={{
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-12 flex-1 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundColor: colors.accent,
                    color: colors.text,
                  }}
                >
                  {isSaving
                    ? "Saving..."
                    : editingExpense
                      ? "Save changes"
                      : "Add expense"}
                </button>
              </div>

              {editingExpense && (
                <button
                  type="button"
                  onClick={() =>
                    requestDelete(editingExpense)
                  }
                  disabled={isSaving}
                  className="w-full pt-1 text-center text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ color: colors.error }}
                >
                  Delete expense
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(11,15,20,0.75)",
          }}
        >
          <div
            className="w-full max-w-sm rounded-lg p-5 shadow-2xl"
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
            }}
          >
            <h2
              className="text-lg font-bold"
              style={{ color: colors.text }}
            >
              Delete this expense?
            </h2>

            <p
              className="mt-3 text-sm"
              style={{ color: colors.text }}
            >
              {deleteTarget.description}
            </p>

            <p
              className="mt-1 text-sm"
              style={{ color: colors.secondary }}
            >
              RM {formatMoney(deleteTarget.amount)} —{" "}
              {formatFullDate(deleteTarget.expense_date)}
            </p>

            <p
              className="mt-3 text-xs"
              style={{ color: colors.muted }}
            >
              This cannot be undone.
            </p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                disabled={isDeleting}
                className="min-h-11 flex-1 rounded-md border px-4 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{
                  borderColor: colors.border,
                  color: colors.text,
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="min-h-11 flex-1 rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: colors.error,
                  color: colors.background,
                }}
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