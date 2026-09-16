"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Employee,
  EmployeeFinancialEvent,
  EmployeeFinancialEventCreate,
  EmployeeFinancialEventType,
  EmployeeFinancialEventUpdate,
  EmployeeNote,
} from "@blacklane-ledger/sdk";
import { sdk } from "@/lib/api";

const EVENT_TYPES: EmployeeFinancialEventType[] = [
  "overtime",
  "advance",
  "payment",
  "debt_offset",
  "leave_no_salary",
];

type Ledger = Awaited<ReturnType<typeof sdk.employees.ledger>>;

const EVENT_LABELS: Record<EmployeeFinancialEventType, string> = {
  overtime: "Overtime",
  advance: "Advance",
  payment: "Payment",
  debt_offset: "Debt Offset",
  leave_no_salary: "No Salary",
};

const EVENT_DESCRIPTIONS: Record<EmployeeFinancialEventType, string> = {
  overtime: "Additional earnings",
  advance: "Advance paid to employee",
  payment: "Salary payment",
  debt_offset: "Debt offset",
  leave_no_salary: "Leave without salary",
};

function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
}

function formatSignedMoney(
  value: string | number | null | undefined,
) {
  const amount = Number(value ?? 0);

  if (amount === 0) {
    return "0.00";
  }

  return `${amount > 0 ? "+" : "-"}${formatMoney(amount)}`;
}

function formatDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function addDays(dateString: string, amount: number) {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);

  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function isFutureDate(dateString: string) {
  const today = new Date();

  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  return dateString > todayString;
}

function getEventAmountSign(type: EmployeeFinancialEventType) {
  if (type === "overtime") {
    return "positive";
  }

  return "negative";
}

function getEventLabel(type: string) {
  return (
    EVENT_LABELS[type as EmployeeFinancialEventType] ??
    type.replaceAll("_", " ")
  );
}

function getEventAmountColor(type: EmployeeFinancialEventType) {
  return type === "overtime"
    ? "text-emerald-400"
    : "text-zinc-300";
}

function getEventPrefix(type: EmployeeFinancialEventType) {
  return getEventAmountSign(type) === "positive" ? "+" : "-";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export default function EmployeeDatePage() {
  const router = useRouter();
  const params = useParams();

  const employeeId =
    typeof params.employeeId === "string"
      ? params.employeeId
      : null;

  const dateParam =
    typeof params.date === "string"
      ? params.date
      : null;

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] =
    useState<EmployeeFinancialEvent | null>(null);

  const [eventType, setEventType] =
    useState<EmployeeFinancialEventType>("advance");
  const [eventAmount, setEventAmount] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventNote, setEventNote] = useState("");

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const targetDate = dateParam ?? "";

  const todayString = useMemo(() => {
    const today = new Date();

    return [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
  }, []);

  const previousDate = useMemo(() => {
    if (!targetDate) {
      return "";
    }

    return addDays(targetDate, -1);
  }, [targetDate]);

  const nextDate = useMemo(() => {
    if (!targetDate) {
      return "";
    }

    return addDays(targetDate, 1);
  }, [targetDate]);

  const nextDisabled =
    !nextDate || nextDate > todayString;

  const previousDisabled =
    !previousDate ||
    Boolean(
      employee?.created_at &&
        previousDate < employee.created_at.slice(0, 10),
    );

  const loadLedger = useCallback(async () => {
    if (!businessId || !employeeId || !targetDate) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [employeeResult, ledgerResult] =
        await Promise.all([
          sdk.employees.get(
            businessId,
            employeeId,
          ),
          sdk.employees.ledger(
            businessId,
            employeeId,
            targetDate,
          ),
        ]);

      setEmployee(employeeResult);
      setLedger(ledgerResult);
    } catch (err) {
      console.error(
        "Failed to load employee date ledger:",
        err,
      );

      setError(
        getErrorMessage(
          err,
          "Failed to load this employee date.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [
    businessId,
    employeeId,
    targetDate,
  ]);

  useEffect(() => {
    const storedBusinessId =
      window.localStorage.getItem("business_id");

    setBusinessId(storedBusinessId);
  }, []);

  useEffect(() => {
    if (
      !targetDate ||
      isFutureDate(targetDate)
    ) {
      if (targetDate) {
        router.replace(
          `/employees/${employeeId ?? ""}`,
        );
      }

      return;
    }

    loadLedger();
  }, [
    targetDate,
    employeeId,
    router,
    loadLedger,
  ]);

  const events = useMemo(() => {
    if (!ledger?.events) {
      return [];
    }

    return [...ledger.events].sort((a, b) => {
      const aTime = a.created_at
        ? new Date(a.created_at).getTime()
        : 0;

      const bTime = b.created_at
        ? new Date(b.created_at).getTime()
        : 0;

      return bTime - aTime;
    });
  }, [ledger]);

  const notes = useMemo(() => {
    if (!ledger?.notes) {
      return [];
    }

    return [...ledger.notes].sort((a, b) => {
      const aTime = a.created_at
        ? new Date(a.created_at).getTime()
        : 0;

      const bTime = b.created_at
        ? new Date(b.created_at).getTime()
        : 0;

      return bTime - aTime;
    });
  }, [ledger]);

  const openCreateEvent = (
    type: EmployeeFinancialEventType = "advance",
  ) => {
    setEditingEvent(null);
    setEventType(type);
    setEventAmount("");
    setEventDescription("");
    setEventNote("");
    setShowEventModal(true);
  };

  const openEditEvent = (
    event: EmployeeFinancialEvent,
  ) => {
    setEditingEvent(event);
    setEventType(event.event_type);
    setEventAmount(
      event.event_type === "leave_no_salary"
        ? ""
        : String(event.amount ?? ""),
    );
    setEventDescription(
      event.description ?? "",
    );
    setEventNote(event.note ?? "");
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    if (saving) {
      return;
    }

    setShowEventModal(false);
    setEditingEvent(null);
  };

  const saveEvent = async () => {
    if (!businessId || !employeeId || !targetDate) {
      return;
    }

    if (
      eventType !== "leave_no_salary" &&
      (!eventAmount ||
        Number(eventAmount) <= 0)
    ) {
      window.alert(
        "Please enter a valid amount.",
      );
      return;
    }

    setSaving(true);

    try {
      if (editingEvent) {
        const updateData: EmployeeFinancialEventUpdate =
          {
            event_date: targetDate,
            event_type: eventType,
            amount:
              eventType === "leave_no_salary"
                ? "0"
                : eventAmount,
            description:
              eventDescription.trim() ||
              getEventLabel(eventType),
            note:
              eventNote.trim() || null,
          };

        await sdk.employees.updateEvent(
          businessId,
          employeeId,
          editingEvent.id,
          updateData,
        );
      } else {
        const createData: EmployeeFinancialEventCreate =
          {
            event_date: targetDate,
            event_type: eventType,
            amount:
              eventType === "leave_no_salary"
                ? "0"
                : eventAmount,
            description:
              eventDescription.trim() ||
              getEventLabel(eventType),
            note:
              eventNote.trim() || null,
          };

        await sdk.employees.createEvent(
          businessId,
          employeeId,
          createData,
        );
      }

      setShowEventModal(false);
      setEditingEvent(null);

      await loadLedger();
    } catch (err) {
      console.error(
        "Failed to save employee event:",
        err,
      );

      window.alert(
        getErrorMessage(
          err,
          "Failed to save event.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (
    event: EmployeeFinancialEvent,
  ) => {
    if (!businessId || !employeeId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete this ${getEventLabel(
        event.event_type,
      ).toLowerCase()} event?`,
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      await sdk.employees.deleteEvent(
        businessId,
        employeeId,
        event.id,
      );

      await loadLedger();
    } catch (err) {
      console.error(
        "Failed to delete employee event:",
        err,
      );

      window.alert(
        getErrorMessage(
          err,
          "Failed to delete event.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const openNoteModal = () => {
    setNoteTitle("");
    setNoteContent("");
    setShowNoteModal(true);
  };

  const closeNoteModal = () => {
    if (savingNote) {
      return;
    }

    setShowNoteModal(false);
  };

  const createNote = async () => {
    if (!businessId || !employeeId || !targetDate) {
      return;
    }

    if (
      !noteTitle.trim() ||
      !noteContent.trim()
    ) {
      window.alert(
        "Please enter a title and note.",
      );
      return;
    }

    setSavingNote(true);

    try {
      await sdk.employees.createNote(
        businessId,
        employeeId,
        {
          note_date: targetDate,
          title: noteTitle.trim(),
          content: noteContent.trim(),
        },
      );

      setShowNoteModal(false);
      setNoteTitle("");
      setNoteContent("");

      await loadLedger();
    } catch (err) {
      console.error(
        "Failed to create employee note:",
        err,
      );

      window.alert(
        getErrorMessage(
          err,
          "Failed to create note.",
        ),
      );
    } finally {
      setSavingNote(false);
    }
  };

  const goToDate = (date: string) => {
    if (!employeeId || !date) {
      return;
    }

    if (isFutureDate(date)) {
      return;
    }

    if (
      employee?.created_at &&
      date < employee.created_at.slice(0, 10)
    ) {
      return;
    }

    router.push(
      `/employees/${employeeId}/${date}`,
    );
  };

  const goBack = () => {
    if (!employeeId) {
      router.push("/employees");
      return;
    }

    router.push(
      `/employees/${employeeId}`,
    );
  };

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#09090b] text-white">
        <div className="mx-auto flex min-h-dvh max-w-6xl items-center justify-center px-4">
          <div className="text-sm text-zinc-500">
            Loading employee ledger...
          </div>
        </div>
      </main>
    );
  }

  if (error || !employee || !ledger) {
    return (
      <main className="min-h-dvh bg-[#09090b] text-white">
        <div className="mx-auto flex min-h-dvh max-w-6xl items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400">
              !
            </div>

            <h1 className="mt-5 text-lg font-semibold">
              Unable to load date
            </h1>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {error ??
                "The employee date ledger could not be loaded."}
            </p>

            <button
              type="button"
              onClick={goBack}
              className="mt-6 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Back to employee
            </button>
          </div>
        </div>
      </main>
    );
  }

  const balance = Number(
    ledger.balance ?? 0,
  );

  const hasLeaveNoSalary =
    Number(ledger.leave_no_salary ?? 0) > 0 ||
    events.some(
      (event) =>
        event.event_type ===
        "leave_no_salary",
    );

  return (
    <main className="min-h-dvh bg-[#09090b] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
            >
              <span className="text-lg">
                ←
              </span>
              Employee
            </button>

            <button
              type="button"
              onClick={() =>
                openCreateEvent("advance")
              }
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              + Add transaction
            </button>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {employee.name}
              </h1>

              {hasLeaveNoSalary && (
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
                  No salary
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-zinc-500">
              Daily employee ledger
            </p>
          </div>
        </div>

        {/* Date navigation */}
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
            <button
              type="button"
              disabled={previousDisabled}
              onClick={() =>
                goToDate(previousDate)
              }
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              ←
              <span className="ml-2 hidden sm:inline">
                Previous
              </span>
            </button>

            <div className="text-center">
              <p className="text-base font-medium text-white sm:text-lg">
                {formatDate(targetDate)}
              </p>

              {targetDate === todayString && (
                <p className="mt-1 text-xs font-medium text-zinc-500">
                  Today
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={nextDisabled}
              onClick={() =>
                goToDate(nextDate)
              }
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <span className="mr-2 hidden sm:inline">
                Next
              </span>
              →
            </button>
          </div>
        </div>

        {/* Summary */}
        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard
            label="Daily salary"
            value={formatMoney(
              ledger.daily_salary,
            )}
          />

          <SummaryCard
            label="Salary earned"
            value={formatMoney(
              ledger.salary_earned,
            )}
          />

          <SummaryCard
            label="Overtime"
            value={formatMoney(
              ledger.overtime,
            )}
            positive
          />

          <SummaryCard
            label="Payments"
            value={formatMoney(
              ledger.payments,
            )}
          />

          <SummaryCard
            label="Advances"
            value={formatMoney(
              ledger.advances,
            )}
          />

          <SummaryCard
            label="Balance"
            value={formatSignedMoney(
              balance,
            )}
            balance
            balanceValue={balance}
          />
        </section>

        {/* Main content */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Transactions */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Transactions
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Activity recorded on this date
                </p>
              </div>

              <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs text-zinc-500">
                {events.length}
              </span>
            </div>

            <div className="p-4">
              {events.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 px-5 py-10 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-500">
                    +
                  </div>

                  <p className="mt-3 text-sm text-zinc-400">
                    No transactions for this date
                  </p>

                  <p className="mt-1 text-xs text-zinc-600">
                    Add an overtime, advance,
                    payment or other event.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      openCreateEvent(
                        "advance",
                      )
                    }
                    className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                  >
                    Add transaction
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => {
                    const isPositive =
                      event.event_type ===
                      "overtime";

                    return (
                      <div
                        key={event.id}
                        className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-700 hover:bg-zinc-900"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-white">
                                {getEventLabel(
                                  event.event_type,
                                )}
                              </span>

                              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                                {event.event_type.replaceAll(
                                  "_",
                                  " ",
                                )}
                              </span>
                            </div>

                            {event.description && (
                              <p className="mt-1.5 text-sm text-zinc-400">
                                {event.description}
                              </p>
                            )}

                            {event.note && (
                              <p className="mt-2 text-xs leading-5 text-zinc-600">
                                {event.note}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 text-right">
                            <p
                              className={`text-sm font-semibold ${
                                isPositive
                                  ? "text-emerald-400"
                                  : "text-zinc-300"
                              }`}
                            >
                              {getEventPrefix(
                                event.event_type,
                              )}
                              {formatMoney(
                                event.amount,
                              )}
                            </p>

                            <div className="mt-2 flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditEvent(
                                    event,
                                  )
                                }
                                disabled={saving}
                                className="text-xs text-zinc-500 transition hover:text-white disabled:opacity-30"
                              >
                                Edit
                              </button>

                              <span className="text-zinc-800">
                                |
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteEvent(
                                    event,
                                  )
                                }
                                disabled={saving}
                                className="text-xs text-zinc-500 transition hover:text-red-400 disabled:opacity-30"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="border-t border-zinc-800 px-4 py-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <QuickAction
                  label="Overtime"
                  onClick={() =>
                    openCreateEvent(
                      "overtime",
                    )
                  }
                />

                <QuickAction
                  label="Advance"
                  onClick={() =>
                    openCreateEvent(
                      "advance",
                    )
                  }
                />

                <QuickAction
                  label="Payment"
                  onClick={() =>
                    openCreateEvent(
                      "payment",
                    )
                  }
                />

                <QuickAction
                  label="No salary"
                  onClick={() =>
                    openCreateEvent(
                      "leave_no_salary",
                    )
                  }
                />
              </div>
            </div>
          </section>

          {/* Right column */}
          <div className="space-y-5">
            {/* Day breakdown */}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950">
              <div className="border-b border-zinc-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-white">
                  Day breakdown
                </h2>
              </div>

              <div className="divide-y divide-zinc-800">
                <BreakdownRow
                  label="Salary earned"
                  value={ledger.salary_earned}
                />

                <BreakdownRow
                  label="Overtime"
                  value={ledger.overtime}
                  positive
                />

                <BreakdownRow
                  label="No salary"
                  value={ledger.leave_no_salary}
                />

                <BreakdownRow
                  label="Payments"
                  value={ledger.payments}
                />

                <BreakdownRow
                  label="Advances"
                  value={ledger.advances}
                />

                <BreakdownRow
                  label="Debt offsets"
                  value={ledger.debt_offsets}
                />

                <div className="flex items-center justify-between px-5 py-4">
                  <span className="text-sm font-medium text-zinc-300">
                    Balance through date
                  </span>

                  <span
                    className={`text-sm font-semibold ${
                      balance >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {balance >= 0 ? "+" : "-"}
                    {formatMoney(balance)}
                  </span>
                </div>
              </div>
            </section>

            {/* Notes */}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950">
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Notes
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    Notes for this date
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openNoteModal}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                >
                  + Add
                </button>
              </div>

              <div className="p-4">
                {notes.length === 0 ? (
                  <p className="py-5 text-center text-xs text-zinc-600">
                    No notes for this date.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {notes.map(
                      (note: EmployeeNote) => (
                        <div
                          key={note.id}
                          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5"
                        >
                          <p className="text-sm font-medium text-zinc-200">
                            {note.title}
                          </p>

                          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-zinc-500">
                            {note.content}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Event modal */}
        {showEventModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              <div className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    {editingEvent
                      ? "Edit transaction"
                      : "Add transaction"}
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    {formatShortDate(
                      targetDate,
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeEventModal
                  }
                  disabled={saving}
                  className="text-lg text-zinc-500 transition hover:text-white disabled:opacity-30"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-400">
                    Transaction type
                  </label>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {EVENT_TYPES.map(
                      (type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() =>
                            setEventType(
                              type,
                            )
                          }
                          className={`rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                            eventType === type
                              ? "border-white bg-white text-black"
                              : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                          }`}
                        >
                          <span className="block font-medium">
                            {EVENT_LABELS[
                              type
                            ]}
                          </span>

                          <span
                            className={`mt-0.5 block text-[10px] ${
                              eventType ===
                              type
                                ? "text-zinc-600"
                                : "text-zinc-600"
                            }`}
                          >
                            {
                              EVENT_DESCRIPTIONS[
                                type
                              ]
                            }
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {eventType !==
                  "leave_no_salary" && (
                  <div>
                    <label className="mb-2 block text-xs font-medium text-zinc-400">
                      Amount
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={eventAmount}
                      onChange={(e) =>
                        setEventAmount(
                          e.target.value,
                        )
                      }
                      placeholder="0.00"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                    />
                  </div>
                )}

                {eventType ===
                  "leave_no_salary" && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                    <p className="text-xs leading-5 text-amber-400">
                      This will mark the selected
                      date as leave without salary.
                      The day's salary earned will
                      become zero.
                    </p>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-400">
                    Description
                  </label>

                  <input
                    type="text"
                    value={eventDescription}
                    onChange={(e) =>
                      setEventDescription(
                        e.target.value,
                      )
                    }
                    placeholder={getEventLabel(
                      eventType,
                    )}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-400">
                    Note
                  </label>

                  <textarea
                    value={eventNote}
                    onChange={(e) =>
                      setEventNote(
                        e.target.value,
                      )
                    }
                    rows={3}
                    placeholder="Optional note..."
                    className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-4">
                <button
                  type="button"
                  onClick={
                    closeEventModal
                  }
                  disabled={saving}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:opacity-30"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveEvent}
                  disabled={saving}
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingEvent
                      ? "Save changes"
                      : "Add transaction"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Note modal */}
        {showNoteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              <div className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Add note
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    {formatShortDate(
                      targetDate,
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeNoteModal
                  }
                  disabled={savingNote}
                  className="text-lg text-zinc-500 transition hover:text-white disabled:opacity-30"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-400">
                    Title
                  </label>

                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) =>
                      setNoteTitle(
                        e.target.value,
                      )
                    }
                    placeholder="Note title"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-400">
                    Note
                  </label>

                  <textarea
                    value={noteContent}
                    onChange={(e) =>
                      setNoteContent(
                        e.target.value,
                      )
                    }
                    rows={5}
                    placeholder="Write a note about this date..."
                    className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-4">
                <button
                  type="button"
                  onClick={
                    closeNoteModal
                  }
                  disabled={savingNote}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:opacity-30"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={createNote}
                  disabled={savingNote}
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingNote
                    ? "Saving..."
                    : "Add note"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  positive = false,
  balance = false,
  balanceValue = 0,
}: {
  label: string;
  value: string;
  positive?: boolean;
  balance?: boolean;
  balanceValue?: number;
}) {
  let valueClass =
    "text-white";

  if (positive) {
    valueClass = "text-emerald-400";
  }

  if (balance) {
    valueClass =
      balanceValue >= 0
        ? "text-emerald-400"
        : "text-red-400";
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
        {label}
      </p>

      <p
        className={`mt-2 text-lg font-semibold tracking-tight ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string | number | null | undefined;
  positive?: boolean;
}) {
  const amount = Number(value ?? 0);

  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-sm text-zinc-500">
        {label}
      </span>

      <span
        className={`text-sm font-medium ${
          positive
            ? "text-emerald-400"
            : "text-zinc-300"
        }`}
      >
        {positive ? "+" : ""}
        {formatMoney(amount)}
      </span>
    </div>
  );
}

function QuickAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
    >
      + {label}
    </button>
  );
}