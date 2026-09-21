"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { sdk } from "@/lib/api";

type PaymentMethod = "daily" | "monthly";

interface Employee {
  id: string;
  business_id: string;
  name: string;
  daily_salary: string;
  payment_method: PaymentMethod;
  accounting_start_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

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

function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

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

export default function EmployeesPage() {
  const router = useRouter();

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  /* ------------------------------------------------------------------------ */
  /* Add employee form                                                        */
  /* ------------------------------------------------------------------------ */

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [dailySalary, setDailySalary] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("monthly");
  const [accountingStartDate, setAccountingStartDate] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /* ------------------------------------------------------------------------ */
  /* Edit employee form                                                       */
  /* ------------------------------------------------------------------------ */

  const [editingEmployee, setEditingEmployee] =
    useState<Employee | null>(null);
  const [editName, setEditName] = useState("");
  const [editDailySalary, setEditDailySalary] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] =
    useState<PaymentMethod>("monthly");
  const [editAccountingStartDate, setEditAccountingStartDate] = useState("");
  const [editSalaryEffectiveFrom, setEditSalaryEffectiveFrom] =
    useState("");

  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  /* ------------------------------------------------------------------------ */
  /* Business ID                                                              */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const storedBusinessId = localStorage.getItem("business_id");

    if (!storedBusinessId || storedBusinessId === "businessId") {
      router.replace("/businesses");
      return;
    }

    setBusinessId(storedBusinessId);
  }, [router]);

  /* ------------------------------------------------------------------------ */
  /* Load employees                                                           */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!businessId) {
      return;
    }

    const currentBusinessId = businessId;
    let cancelled = false;

    async function loadEmployees() {
      setIsLoading(true);
      setError(null);
      setSessionExpired(false);

      try {
        const result = await sdk.employees.list(currentBusinessId);

        if (!cancelled) {
          setEmployees(result);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        const status = getErrorStatus(err);

        if (status === 401) {
          setSessionExpired(true);
          setError("Your session has expired. Please sign in again.");
        } else if (status === 404) {
          localStorage.removeItem("business_id");
          router.replace("/businesses");
          return;
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load employees.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadEmployees();

    return () => {
      cancelled = true;
    };
  }, [businessId, router]);

  /* ------------------------------------------------------------------------ */
  /* Add employee                                                             */
  /* ------------------------------------------------------------------------ */

  function openAddForm() {
    setName("");
    setDailySalary("");
    setPaymentMethod("monthly");
    setAccountingStartDate("");
    setFormError(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSaving) {
      return;
    }

    setIsFormOpen(false);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!businessId) {
      setFormError("No business is selected.");
      return;
    }

    const parsedSalary = Number(dailySalary);

    if (!name.trim()) {
      setFormError("Enter the employee's name.");
      return;
    }

    if (!Number.isFinite(parsedSalary) || parsedSalary <= 0) {
      setFormError("Enter a daily salary greater than zero.");
      return;
    }

    if (!accountingStartDate) {
      setFormError("Select the employee's accounting start date.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const employee = await sdk.employees.create(businessId, {
        name: name.trim(),
        daily_salary: parsedSalary.toFixed(2),
        payment_method: paymentMethod,
        accounting_start_date: accountingStartDate,
      });

      setEmployees((current) => [...current, employee]);
      setIsFormOpen(false);

      router.push(`/employees/${employee.id}`);
    } catch (err) {
      const status = getErrorStatus(err);

      if (status === 401) {
        setFormError("Your session has expired. Please sign in again.");
      } else if (status === 422) {
        setFormError("Please check the employee details.");
      } else {
        setFormError(
          err instanceof Error
            ? err.message
            : "Unable to create the employee.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Edit employee                                                            */
  /* ------------------------------------------------------------------------ */

  function openEditForm(employee: Employee) {
    setEditingEmployee(employee);
    setEditName(employee.name);
    setEditDailySalary(employee.daily_salary);
    setEditPaymentMethod(employee.payment_method);
    setEditAccountingStartDate(employee.accounting_start_date);

    /*
     * Default the salary-history effective date to the employee's
     * accounting start date.
     *
     * This date is only sent to the backend when the salary or
     * payment method changes.
     */
    setEditSalaryEffectiveFrom(employee.accounting_start_date);

    setEditFormError(null);
    setIsEditFormOpen(true);
  }

  function closeEditForm() {
    if (isEditSaving) {
      return;
    }

    setIsEditFormOpen(false);
    setEditingEmployee(null);
    setEditFormError(null);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!businessId || !editingEmployee) {
      setEditFormError("No employee is selected.");
      return;
    }

    const parsedSalary = Number(editDailySalary);

    if (!editName.trim()) {
      setEditFormError("Enter the employee's name.");
      return;
    }

    if (!Number.isFinite(parsedSalary) || parsedSalary <= 0) {
      setEditFormError("Enter a daily salary greater than zero.");
      return;
    }

    if (!editAccountingStartDate) {
      setEditFormError("Select the employee's accounting start date.");
      return;
    }

    const salaryChanged =
      editDailySalary !== editingEmployee.daily_salary ||
      editPaymentMethod !== editingEmployee.payment_method;

    if (salaryChanged && !editSalaryEffectiveFrom) {
      setEditFormError("Select the salary effective date.");
      return;
    }

    setIsEditSaving(true);
    setEditFormError(null);

    try {
      const updatedEmployee = await sdk.employees.update(
        businessId,
        editingEmployee.id,
        {
          name: editName.trim(),
          daily_salary: parsedSalary.toFixed(2),
          payment_method: editPaymentMethod,
          accounting_start_date: editAccountingStartDate,
          ...(salaryChanged
            ? {
                salary_effective_from: editSalaryEffectiveFrom,
              }
            : {}),
        },
      );

      setEmployees((current) =>
        current.map((employee) =>
          employee.id === updatedEmployee.id
            ? updatedEmployee
            : employee,
        ),
      );

      setIsEditFormOpen(false);
      setEditingEmployee(null);
      setEditFormError(null);
    } catch (err) {
      const status = getErrorStatus(err);

      if (status === 401) {
        setEditFormError(
          "Your session has expired. Please sign in again.",
        );
      } else if (status === 422) {
        setEditFormError("Please check the employee details.");
      } else {
        setEditFormError(
          err instanceof Error
            ? err.message
            : "Unable to update the employee.",
        );
      }
    } finally {
      setIsEditSaving(false);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Sign out                                                                 */
  /* ------------------------------------------------------------------------ */

  function handleSignOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("business_id");
    router.replace("/login");
  }

  /* ------------------------------------------------------------------------ */
  /* UI                                                                       */
  /* ------------------------------------------------------------------------ */

  return (
    <main
      className="min-h-screen pb-24"
      style={{
        backgroundColor: colors.background,
        color: colors.text,
      }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
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
              Employees
            </h1>

            <p
              className="mt-1 text-sm"
              style={{ color: colors.secondary }}
            >
              Salaries, payments and employee balances
            </p>
          </div>

          <button
            type="button"
            onClick={openAddForm}
            className="shrink-0 rounded-md px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: colors.accent,
              color: colors.text,
            }}
          >
            + Add
          </button>
        </div>

        {sessionExpired && (
          <div
            className="mb-4 flex items-center justify-between gap-3 rounded-md px-4 py-3 text-sm"
            style={{
              backgroundColor: colors.errorBackground,
              color: colors.error,
            }}
          >
            <span>Your session has expired.</span>

            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md border px-3 py-1.5 text-xs font-semibold"
              style={{
                borderColor: colors.error,
                color: colors.error,
              }}
            >
              Sign in
            </button>
          </div>
        )}

        {error && !sessionExpired && (
          <div
            className="mb-4 rounded-md px-4 py-3 text-sm"
            style={{
              backgroundColor: colors.errorBackground,
              color: colors.error,
            }}
          >
            {error}
          </div>
        )}

        {isLoading ? (
          <section
            className="overflow-hidden rounded-lg"
            style={{
              border: `1px solid ${colors.border}`,
            }}
          >
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-20 animate-pulse"
                style={{
                  backgroundColor: colors.surface,
                  borderBottom:
                    item !== 3
                      ? `1px solid ${colors.border}`
                      : undefined,
                }}
              />
            ))}
          </section>
        ) : employees.length === 0 ? (
          <section
            className="rounded-lg border border-dashed px-5 py-14 text-center"
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
              No employees yet
            </h2>

            <p
              className="mx-auto mt-2 max-w-sm text-sm leading-6"
              style={{ color: colors.secondary }}
            >
              Add an employee to start tracking their daily
              salary, payments and balance.
            </p>

            <button
              type="button"
              onClick={openAddForm}
              className="mt-5 min-h-12 rounded-md px-5 text-sm font-semibold"
              style={{
                backgroundColor: colors.accent,
                color: colors.text,
              }}
            >
              Add first employee
            </button>
          </section>
        ) : (
          <section
            className="overflow-hidden rounded-lg"
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
            }}
          >
            {employees.map((employee, index) => (
              <div
                key={employee.id}
                className="flex w-full items-center justify-between gap-3 px-4 py-4"
                style={{
                  borderTop:
                    index === 0
                      ? "none"
                      : `1px solid ${colors.border}`,
                  opacity: employee.is_active ? 1 : 0.55,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/employees/${employee.id}`)
                  }
                  className="min-w-0 flex-1 text-left transition-opacity hover:opacity-80"
                >
                  <div className="flex items-center gap-2">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: colors.text }}
                    >
                      {employee.name}
                    </p>

                    {!employee.is_active && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          color: colors.muted,
                          backgroundColor: colors.accentSoft,
                        }}
                      >
                        Inactive
                      </span>
                    )}
                  </div>

                  <p
                    className="mt-1 text-xs"
                    style={{ color: colors.secondary }}
                  >
                    RM {formatMoney(employee.daily_salary)} / day
                  </p>
                </button>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize"
                    style={{
                      color: colors.accent,
                      backgroundColor: colors.accentSoft,
                    }}
                  >
                    {employee.payment_method}
                  </span>

                  <button
                    type="button"
                    onClick={() => openEditForm(employee)}
                    aria-label={`Edit ${employee.name}`}
                    className="flex h-10 w-10 items-center justify-center rounded-md border text-base transition-opacity hover:opacity-80"
                    style={{
                      borderColor: colors.border,
                      color: colors.secondary,
                    }}
                  >
                    ⚙
                  </button>

                  <span
                    className="text-lg"
                    style={{ color: colors.muted }}
                  >
                    ›
                  </span>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      <button
        type="button"
        onClick={openAddForm}
        aria-label="Add employee"
        className="fixed bottom-20 right-5 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-semibold shadow-lg transition-opacity hover:opacity-90 active:scale-[0.96] sm:right-8 "
        style={{
          backgroundColor: colors.accent,
          color: colors.text,
        }}
      >
        +
      </button>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t md:hidden"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
      >
        {[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sales", href: "/sales" },
          { label: "Expenses", href: "/expenses" },
          { label: "More", href: "/more" },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium"
            style={{ color: colors.secondary }}
          >
            {item.label}
          </a>
        ))}
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* Edit employee modal                                                */}
      {/* ------------------------------------------------------------------ */}

      {isEditFormOpen && editingEmployee && (
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
                  Edit employee
                </h2>

                <p
                  className="mt-1 text-sm"
                  style={{ color: colors.secondary }}
                >
                  Update {editingEmployee.name}&apos;s employee details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditForm}
                className="flex h-10 w-10 items-center justify-center rounded-md text-xl"
                style={{ color: colors.secondary }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleEditSubmit}
              className="space-y-5"
            >
              <label className="block">
                <span
                  className="mb-2 block text-sm font-semibold"
                  style={{ color: colors.text }}
                >
                  Employee name
                </span>

                <input
                  type="text"
                  value={editName}
                  onChange={(event) =>
                    setEditName(event.target.value)
                  }
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
                  Daily salary
                </span>

                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: colors.muted }}
                  >
                    RM
                  </span>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={editDailySalary}
                    onChange={(event) =>
                      setEditDailySalary(event.target.value)
                    }
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
                  Payment method
                </span>

                <select
                  value={editPaymentMethod}
                  onChange={(event) =>
                    setEditPaymentMethod(
                      event.target.value as PaymentMethod,
                    )
                  }
                  className="min-h-12 w-full rounded-md border px-4 text-base outline-none"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                </select>
              </label>

              <label className="block">
                <span
                  className="mb-2 block text-sm font-semibold"
                  style={{ color: colors.text }}
                >
                  Accounting start date
                </span>

                <input
                  type="date"
                  value={editAccountingStartDate}
                  onChange={(event) =>
                    setEditAccountingStartDate(event.target.value)
                  }
                  className="min-h-12 w-full rounded-md border px-4 text-base outline-none"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                  required
                />

                <p
                  className="mt-2 text-xs leading-5"
                  style={{ color: colors.muted }}
                >
                  The date from which this employee&apos;s bookkeeping
                  records begin.
                </p>
              </label>

              <label className="block">
                <span
                  className="mb-2 block text-sm font-semibold"
                  style={{ color: colors.text }}
                >
                  Salary effective from
                </span>

                <input
                  type="date"
                  value={editSalaryEffectiveFrom}
                  onChange={(event) =>
                    setEditSalaryEffectiveFrom(event.target.value)
                  }
                  className="min-h-12 w-full rounded-md border px-4 text-base outline-none"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                />

                <p
                  className="mt-2 text-xs leading-5"
                  style={{ color: colors.muted }}
                >
                  Used when the daily salary or payment method
                  changes. Previous salary history remains unchanged.
                </p>
              </label>

              {editFormError && (
                <div
                  className="rounded-md px-4 py-3 text-sm"
                  style={{
                    backgroundColor: colors.errorBackground,
                    color: colors.error,
                  }}
                >
                  {editFormError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeEditForm}
                  disabled={isEditSaving}
                  className="min-h-12 flex-1 rounded-md border px-4 text-sm font-semibold"
                  style={{
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isEditSaving}
                  className="min-h-12 flex-1 rounded-md px-4 text-sm font-semibold disabled:opacity-50"
                  style={{
                    backgroundColor: colors.accent,
                    color: colors.text,
                  }}
                >
                  {isEditSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Add employee modal                                                  */}
      {/* ------------------------------------------------------------------ */}

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
                  Add employee
                </h2>

                <p
                  className="mt-1 text-sm"
                  style={{ color: colors.secondary }}
                >
                  Set the employee&apos;s current daily rate.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="flex h-10 w-10 items-center justify-center rounded-md text-xl"
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
                  Employee name
                </span>

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="e.g. Ahmad"
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
                  Daily salary
                </span>

                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: colors.muted }}
                  >
                    RM
                  </span>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={dailySalary}
                    onChange={(event) =>
                      setDailySalary(event.target.value)
                    }
                    placeholder="100.00"
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
                  Payment method
                </span>

                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target.value as PaymentMethod,
                    )
                  }
                  className="min-h-12 w-full rounded-md border px-4 text-base outline-none"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                </select>
              </label>

              <label className="block">
                <span
                  className="mb-2 block text-sm font-semibold"
                  style={{ color: colors.text }}
                >
                  Accounting start date
                </span>

                <input
                  type="date"
                  value={accountingStartDate}
                  onChange={(event) =>
                    setAccountingStartDate(event.target.value)
                  }
                  className="min-h-12 w-full rounded-md border px-4 text-base outline-none"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                  required
                />

                <p
                  className="mt-2 text-xs leading-5"
                  style={{ color: colors.muted }}
                >
                  The date from which this employee&apos;s
                  bookkeeping records begin.
                </p>
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

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSaving}
                  className="min-h-12 flex-1 rounded-md border px-4 text-sm font-semibold"
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
                  className="min-h-12 flex-1 rounded-md px-4 text-sm font-semibold disabled:opacity-50"
                  style={{
                    backgroundColor: colors.accent,
                    color: colors.text,
                  }}
                >
                  {isSaving ? "Saving..." : "Add employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}