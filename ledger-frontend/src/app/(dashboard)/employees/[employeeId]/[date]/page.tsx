"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Employee,
  EmployeeDailyRecord,
  EmployeeDailyRecordCreate,
  EmployeeDailyRecordUpdate,
  EmployeeFinancialEvent,
  EmployeeFinancialEventCreate,
  EmployeeNote,
} from "@blacklane-ledger/sdk";
import { sdk } from "@/lib/api";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

const SHIFT_OPTIONS = ["day", "night"] as const;
type Shift = (typeof SHIFT_OPTIONS)[number];

type AttendanceStatus = "present" | "leave";

type Ledger = Awaited<ReturnType<typeof sdk.employees.ledger>>;

/* -------------------------------------------------------------------------- */
/* Theme                                                                      */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getLocalDateString(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, amount: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);

  return getLocalDateString(date);
}

function isFutureDate(dateString: string) {
  return dateString > getLocalDateString();
}

function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
}

function formatDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function getSettlementDate(targetDate: string, shift: Shift) {
  return shift === "night" ? addDays(targetDate, 1) : targetDate;
}

function getSettlementNote(targetDate: string) {
  return `Settlement for employee balance through ${formatShortDate(targetDate)}.`;
}

function getLatestSettlementEvent(
  events: EmployeeFinancialEvent[],
  targetDate: string,
) {
  const note = getSettlementNote(targetDate);

  return (
    events
      .filter(
        (event) =>
          event.event_type === "payment" &&
          event.description === "Employee salary settlement" &&
          event.note === note,
      )
      .sort((a, b) => {
        const aTime = a.created_at
          ? new Date(a.created_at).getTime()
          : 0;
        const bTime = b.created_at
          ? new Date(b.created_at).getTime()
          : 0;

        return bTime - aTime;
      })[0] ?? null
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function EmployeeDatePage() {
  const router = useRouter();
  const params = useParams();

  const employeeId =
    typeof params.employeeId === "string" ? params.employeeId : null;

  const dateParam =
    typeof params.date === "string" ? params.date : null;

  const targetDate = dateParam ?? "";

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [allEvents, setAllEvents] = useState<EmployeeFinancialEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------------------------------------------------ */
  /* Daily form                                                               */
  /* ------------------------------------------------------------------------ */

  const [selectedShift, setSelectedShift] = useState<Shift>("day");
  const [attendanceStatus, setAttendanceStatus] =
    useState<AttendanceStatus>("present");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [overtime, setOvertime] = useState("");
  const [salaryCut, setSalaryCut] = useState("");

  /* ------------------------------------------------------------------------ */
  /* Modals                                                                   */
  /* ------------------------------------------------------------------------ */

  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  /* ------------------------------------------------------------------------ */
  /* Load business ID                                                         */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const storedBusinessId = window.localStorage.getItem("business_id");
    setBusinessId(storedBusinessId);
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Load ledger and payment history                                          */
  /* ------------------------------------------------------------------------ */

  async function loadLedger() {
    if (!businessId || !employeeId || !targetDate) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [employeeResult, ledgerResult, eventsResult] = await Promise.all([
        sdk.employees.get(businessId, employeeId),
        sdk.employees.ledger(businessId, employeeId, targetDate),
        sdk.employees.listEvents(businessId, employeeId),
      ]);

      setEmployee(employeeResult);
      setLedger(ledgerResult);
      setAllEvents(eventsResult);
    } catch (err) {
      console.error("Failed to load employee date ledger:", err);

      setError(
        getErrorMessage(err, "Failed to load this employee date."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!targetDate) {
      return;
    }

    if (isFutureDate(targetDate)) {
      router.replace(`/employees/${employeeId ?? ""}`);
      return;
    }

    void loadLedger();
  }, [businessId, employeeId, targetDate, router]);

  /* ------------------------------------------------------------------------ */
  /* Date validation                                                          */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (
      employee?.accounting_start_date &&
      targetDate &&
      targetDate < employee.accounting_start_date
    ) {
      router.replace(`/employees/${employeeId ?? ""}`);
    }
  }, [employee?.accounting_start_date, targetDate, employeeId, router]);

  /* ------------------------------------------------------------------------ */
  /* Daily record                                                             */
  /* ------------------------------------------------------------------------ */

  const dailyRecords = useMemo(
    () => [...(ledger?.daily_records ?? [])],
    [ledger?.daily_records],
  );

  /*
   * There is intentionally only one daily employee transaction for a date.
   * The shift is a field on that record, not a second transaction.
   *
   * If legacy data contains more than one record, the first record is used
   * for editing so this page never creates another record for the date.
   */
  const selectedRecord = dailyRecords[0] ?? null;

  /* ------------------------------------------------------------------------ */
  /* Populate the single daily record                                         */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const record = dailyRecords[0] ?? null;

    if (!record) {
      setSelectedShift("day");
      setAttendanceStatus("present");
      setSalaryAmount(
        ledger?.daily_salary != null ? String(ledger.daily_salary) : "",
      );
      setOvertime("0");
      setSalaryCut("0");
      return;
    }

    setSelectedShift(record.shift);
    setAttendanceStatus(record.status);
    setSalaryAmount(String(record.salary_amount ?? 0));
    setOvertime(String(record.overtime ?? 0));
    setSalaryCut(String(record.salary_cut ?? 0));
  }, [dailyRecords, ledger?.daily_salary]);

  /* ------------------------------------------------------------------------ */
  /* Ledger values                                                            */
  /* ------------------------------------------------------------------------ */

  const balance = Number(ledger?.balance ?? 0);
  /* ------------------------------------------------------------------------ */
  /* Today's form calculation                                                 */
  /* ------------------------------------------------------------------------ */

  const currentSalary =
    attendanceStatus === "present" ? Number(salaryAmount || 0) : 0;

  const currentOvertime =
    attendanceStatus === "present" ? Number(overtime || 0) : 0;

  const currentSalaryCut =
    attendanceStatus === "present" ? Number(salaryCut || 0) : 0;

  const todayEarning =
    currentSalary + currentOvertime - currentSalaryCut;

  /* ------------------------------------------------------------------------ */
  /* Settlement state                                                          */
  /* ------------------------------------------------------------------------ */

  const settlementDate = getSettlementDate(targetDate, selectedShift);
  const settlementEvent = useMemo(
    () => getLatestSettlementEvent(allEvents, targetDate),
    [allEvents, targetDate],
  );

  const settlementAlreadyRecorded = Boolean(settlementEvent);

  const savedRecordEarning = selectedRecord
    ? selectedRecord.status === "present"
      ? Number(selectedRecord.salary_amount ?? 0) +
        Number(selectedRecord.overtime ?? 0) -
        Number(selectedRecord.salary_cut ?? 0)
      : 0
    : 0;

  /*
   * ledger.balance includes the saved daily record when it exists.
   * Replace that saved earning with the current form value so edits are
   * reflected immediately in the amount shown for settlement.
   */
  const projectedBalance =
    balance - savedRecordEarning + todayEarning;

  const existingSettlementAmount = settlementEvent
    ? Math.abs(Number(settlementEvent.amount ?? 0))
    : 0;

  /*
   * For a day-shift settlement, the payment date is the selected date, so
   * ledger.balance already includes the existing payment. Add that payment
   * back when calculating the amount that an edited settlement should hold.
   *
   * For a night shift, the payment date is tomorrow, so the selected-date
   * ledger does not include that future payment and projectedBalance already
   * represents the full amount to settle.
   */
  const settlementAmount = Math.max(
    settlementAlreadyRecorded && settlementDate <= targetDate
      ? projectedBalance + existingSettlementAmount
      : projectedBalance,
    0,
  );

  /* ------------------------------------------------------------------------ */
  /* Payment summary                                                          */
  /* ------------------------------------------------------------------------ */

  const outstandingAfterRecordedPayment = settlementAlreadyRecorded
    ? Math.max(
        settlementDate > targetDate
          ? projectedBalance - existingSettlementAmount
          : projectedBalance,
        0,
      )
    : Math.max(projectedBalance, 0);

  const paymentStatusText = settlementAlreadyRecorded
    ? "Settled"
    : "Not settled";

  const paymentStatusColor = settlementAlreadyRecorded
    ? "#7DD3A8"
    : colors.secondary;

  /* ------------------------------------------------------------------------ */
  /* Notes                                                                     */
  /* ------------------------------------------------------------------------ */

  const notes = useMemo(() => {
    if (!ledger?.notes) {
      return [];
    }

    return [...ledger.notes].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;

      return bTime - aTime;
    });
  }, [ledger?.notes]);

  /* ------------------------------------------------------------------------ */
  /* Navigation                                                               */
  /* ------------------------------------------------------------------------ */

  const previousDate = targetDate ? addDays(targetDate, -1) : "";
  const nextDate = targetDate ? addDays(targetDate, 1) : "";
  const todayString = getLocalDateString();

  const previousDisabled =
    !previousDate ||
    Boolean(
      employee?.accounting_start_date &&
        previousDate < employee.accounting_start_date,
    );

  const nextDisabled = !nextDate || nextDate > todayString;

  function goToDate(date: string) {
    if (!employeeId || !date || isFutureDate(date)) {
      return;
    }

    if (
      employee?.accounting_start_date &&
      date < employee.accounting_start_date
    ) {
      return;
    }

    router.push(`/employees/${employeeId}/${date}`);
  }

  function goBack() {
    if (!employeeId) {
      router.push("/employees");
      return;
    }

    router.push(`/employees/${employeeId}`);
  }

  /* ------------------------------------------------------------------------ */
  /* Attendance                                                               */
  /* ------------------------------------------------------------------------ */

  function selectAttendance(status: AttendanceStatus) {
    setAttendanceStatus(status);

    if (status === "leave") {
      setSalaryAmount("0");
      setOvertime("0");
      setSalaryCut("0");
      return;
    }

    if (!salaryAmount || Number(salaryAmount) === 0) {
      setSalaryAmount(
        ledger?.daily_salary != null ? String(ledger.daily_salary) : "",
      );
    }

    if (!overtime) {
      setOvertime("0");
    }

    if (!salaryCut) {
      setSalaryCut("0");
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Save daily record without settling                                       */
  /* ------------------------------------------------------------------------ */

  async function saveWithoutSettling() {
    if (!businessId || !employeeId || !targetDate) {
      return;
    }

    if (
      employee?.accounting_start_date &&
      targetDate < employee.accounting_start_date
    ) {
      window.alert(
        "This date is before the employee's accounting start date.",
      );
      return;
    }

    const salary = attendanceStatus === "leave" ? "0" : salaryAmount || "0";
    const ot = attendanceStatus === "leave" ? "0" : overtime || "0";
    const cut = attendanceStatus === "leave" ? "0" : salaryCut || "0";

    if (Number(salary) < 0 || Number(ot) < 0 || Number(cut) < 0) {
      window.alert("Amounts cannot be negative.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const recordData: EmployeeDailyRecordCreate = {
        record_date: targetDate,
        shift: selectedShift,
        status: attendanceStatus,
        salary_amount: salary,
        overtime: ot,
        salary_cut: cut,
      };

      if (selectedRecord) {
        const updateData: EmployeeDailyRecordUpdate = recordData;

        await sdk.employees.updateDailyRecord(
          businessId,
          employeeId,
          selectedRecord.id,
          updateData,
        );
      } else {
        await sdk.employees.createDailyRecord(
          businessId,
          employeeId,
          recordData,
        );
      }

      await loadLedger();
    } catch (err) {
      console.error("Failed to save employee daily record:", err);

      window.alert(
        getErrorMessage(err, "Failed to save today's record."),
      );
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Settlement                                                               */
  /* ------------------------------------------------------------------------ */

  function openSettlementConfirmation() {
    if (!businessId || !employeeId || !targetDate) {
      return;
    }

    if (settlementAmount <= 0) {
      window.alert("There is no positive employee balance to settle.");
      return;
    }

    setShowSettlementModal(true);
  }

  async function settleNow() {
    if (!businessId || !employeeId || !targetDate) {
      return;
    }

    const amount = settlementAmount;

    if (amount <= 0) {
      return;
    }

    setSettling(true);

    try {
      const salary = attendanceStatus === "leave" ? "0" : salaryAmount || "0";
      const ot = attendanceStatus === "leave" ? "0" : overtime || "0";
      const cut = attendanceStatus === "leave" ? "0" : salaryCut || "0";

      const recordData: EmployeeDailyRecordCreate = {
        record_date: targetDate,
        shift: selectedShift,
        status: attendanceStatus,
        salary_amount: salary,
        overtime: ot,
        salary_cut: cut,
      };

      if (selectedRecord) {
        const updateData: EmployeeDailyRecordUpdate = recordData;

        await sdk.employees.updateDailyRecord(
          businessId,
          employeeId,
          selectedRecord.id,
          updateData,
        );
      } else {
        await sdk.employees.createDailyRecord(
          businessId,
          employeeId,
          recordData,
        );
      }

      const paymentData = {
        event_date: settlementDate,
        event_type: "payment" as const,
        amount: amount.toFixed(2),
        description: "Employee salary settlement",
        note: getSettlementNote(targetDate),
      };

      if (settlementEvent) {
        await sdk.employees.updateEvent(
          businessId,
          employeeId,
          settlementEvent.id,
          paymentData,
        );
      } else {
        const createData: EmployeeFinancialEventCreate = paymentData;

        await sdk.employees.createEvent(
          businessId,
          employeeId,
          createData,
        );
      }

      setShowSettlementModal(false);
      await loadLedger();
    } catch (err) {
      console.error("Failed to settle employee balance:", err);

      window.alert(
        getErrorMessage(err, "Failed to settle employee balance."),
      );
    } finally {
      setSettling(false);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Notes                                                                     */
  /* ------------------------------------------------------------------------ */

  function openNoteModal() {
    setNoteTitle("");
    setNoteContent("");
    setShowNoteModal(true);
  }

  function closeNoteModal() {
    if (savingNote) {
      return;
    }

    setShowNoteModal(false);
  }

  async function createNote() {
    if (!businessId || !employeeId || !targetDate) {
      return;
    }

    if (!noteTitle.trim() || !noteContent.trim()) {
      window.alert("Please enter a title and note.");
      return;
    }

    setSavingNote(true);

    try {
      await sdk.employees.createNote(businessId, employeeId, {
        note_date: targetDate,
        title: noteTitle.trim(),
        content: noteContent.trim(),
      });

      setShowNoteModal(false);
      setNoteTitle("");
      setNoteContent("");

      await loadLedger();
    } catch (err) {
      console.error("Failed to create employee note:", err);

      window.alert(getErrorMessage(err, "Failed to create note."));
    } finally {
      setSavingNote(false);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Loading                                                                   */
  /* ------------------------------------------------------------------------ */

  if (loading) {
    return (
      <main
        className="min-h-dvh text-white"
        style={{ backgroundColor: colors.background }}
      >
        <div className="mx-auto flex min-h-dvh max-w-4xl items-center justify-center px-4">
          <div
            className="text-sm"
            style={{ color: colors.muted }}
          >
            Loading employee...
          </div>
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Error                                                                     */
  /* ------------------------------------------------------------------------ */

  if (error || !employee || !ledger) {
    return (
      <main
        className="min-h-dvh text-white"
        style={{ backgroundColor: colors.background }}
      >
        <div className="mx-auto flex min-h-dvh max-w-4xl items-center justify-center px-4">
          <div
            className="w-full max-w-md rounded-2xl border p-6 text-center"
            style={{
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border"
              style={{
                borderColor: colors.border,
                backgroundColor: colors.background,
                color: colors.secondary,
              }}
            >
              !
            </div>

            <h1 className="mt-5 text-lg font-semibold">Unable to load date</h1>

            <p
              className="mt-2 text-sm leading-6"
              style={{ color: colors.secondary }}
            >
              {error ?? "The employee date ledger could not be loaded."}
            </p>

            <button
              type="button"
              onClick={goBack}
              className="mt-6 rounded-xl px-4 py-2.5 text-sm font-medium transition"
              style={{
                backgroundColor: colors.accent,
                color: colors.text,
              }}
            >
              Back to employee
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <main
      className="min-h-dvh text-white"
      style={{ backgroundColor: colors.background }}
    >
      <div
        className="mx-auto w-full max-w-4xl px-4 pt-5 sm:px-6 sm:pt-7"
        style={{
          paddingBottom: "calc(7rem + env(safe-area-inset-bottom))",
        }}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ---------------------------------------------------------------- */}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 text-sm transition"
            style={{ color: colors.secondary }}
          >
            <span className="text-lg">←</span>
            Employee
          </button>

          <button
            type="button"
            onClick={openNoteModal}
            className="rounded-xl border px-3.5 py-2 text-xs font-medium transition"
            style={{
              borderColor: colors.border,
              backgroundColor: colors.surface,
              color: colors.secondary,
            }}
          >
            + Add note
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Employee / date                                                    */}
        {/* ---------------------------------------------------------------- */}

        <div className="mt-6">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {employee.name}
          </h1>

          <p
            className="mt-1 text-sm"
            style={{ color: colors.secondary }}
          >
            {formatDate(targetDate)}
          </p>

          {targetDate === todayString && (
            <span
              className="mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
              style={{
                backgroundColor: colors.accentSoft,
                color: "#7DD3A8",
              }}
            >
              Today
            </span>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Date navigation                                                    */}
        {/* ---------------------------------------------------------------- */}

        <div
          className="mt-5 flex items-center justify-between rounded-2xl border p-2"
          style={{
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <button
            type="button"
            disabled={previousDisabled}
            onClick={() => goToDate(previousDate)}
            className="rounded-xl px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ color: colors.secondary }}
          >
            ‹
            <span className="ml-1 hidden sm:inline">Previous</span>
          </button>

          <span
            className="text-xs"
            style={{ color: colors.muted }}
          >
            {formatShortDate(targetDate)}
          </span>

          <button
            type="button"
            disabled={nextDisabled}
            onClick={() => goToDate(nextDate)}
            className="rounded-xl px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ color: colors.secondary }}
          >
            <span className="mr-1 hidden sm:inline">Next</span>
            ›
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Shift toggle                                                       */}
        {/* ---------------------------------------------------------------- */}

        <section
          className="mt-5 rounded-2xl border p-4"
          style={{
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <div>
            <p
              className="text-xs font-medium"
              style={{ color: colors.secondary }}
            >
              Shift
            </p>

            <p
              className="mt-1 text-xs"
              style={{ color: colors.muted }}
            >
              Select the employee's working cycle.
            </p>
          </div>

          <div
            className="mt-4 grid grid-cols-2 rounded-xl border p-1"
            style={{
              borderColor: colors.border,
              backgroundColor: colors.background,
            }}
          >
            {SHIFT_OPTIONS.map((shift) => {
              const active = selectedShift === shift;

              return (
                <button
                  key={shift}
                  type="button"
                  onClick={() => setSelectedShift(shift)}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium capitalize transition"
                  style={{
                    backgroundColor: active ? colors.accent : "transparent",
                    color: active ? colors.text : colors.secondary,
                  }}
                >
                  {shift}
                </button>
              );
            })}
          </div>

          <p
            className="mt-2 text-center text-[11px]"
            style={{ color: colors.muted }}
          >
            {selectedShift === "day" ? "7 AM – 7 PM" : "7 PM – 7 AM"}
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Attendance                                                        */}
        {/* ---------------------------------------------------------------- */}

        <section
          className="mt-4 rounded-2xl border p-4"
          style={{
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <p
            className="text-xs font-medium"
            style={{ color: colors.secondary }}
          >
            Attendance
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => selectAttendance("present")}
              className="rounded-xl border px-4 py-3 text-sm font-medium transition"
              style={{
                borderColor:
                  attendanceStatus === "present"
                    ? colors.accent
                    : colors.border,
                backgroundColor:
                  attendanceStatus === "present"
                    ? colors.accentSoft
                    : colors.background,
                color:
                  attendanceStatus === "present"
                    ? "#7DD3A8"
                    : colors.secondary,
              }}
            >
              Present
            </button>

            <button
              type="button"
              onClick={() => selectAttendance("leave")}
              className="rounded-xl border px-4 py-3 text-sm font-medium transition"
              style={{
                borderColor:
                  attendanceStatus === "leave"
                    ? colors.error
                    : colors.border,
                backgroundColor:
                  attendanceStatus === "leave"
                    ? colors.errorBackground
                    : colors.background,
                color:
                  attendanceStatus === "leave"
                    ? colors.error
                    : colors.secondary,
              }}
            >
              Leave
            </button>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Salary                                                             */}
        {/* ---------------------------------------------------------------- */}

        <section
          className="mt-4 rounded-2xl border p-4"
          style={{
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className="text-xs font-medium"
                style={{ color: colors.secondary }}
              >
                Salary
              </p>

              <p
                className="mt-1 text-xs"
                style={{ color: colors.muted }}
              >
                Per-day salary for this date. You can edit it when needed.
              </p>
            </div>

            {ledger.daily_salary != null && (
              <span
                className="text-xs"
                style={{ color: colors.muted }}
              >
                Rate: RM {formatMoney(ledger.daily_salary)}
              </span>
            )}
          </div>

          <div className="mt-4">
            <label
              className="mb-2 block text-[11px]"
              style={{ color: colors.muted }}
            >
              Base salary
            </label>

            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                style={{ color: colors.muted }}
              >
                RM
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={salaryAmount}
                onChange={(event) => setSalaryAmount(event.target.value)}
                disabled={attendanceStatus === "leave" || saving || settling}
                className="w-full rounded-xl border py-3 pl-11 pr-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  color: colors.text,
                }}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MoneyInput
              label="Overtime"
              value={overtime}
              onChange={setOvertime}
              disabled={attendanceStatus === "leave" || saving || settling}
            />

            <MoneyInput
              label="Salary cut"
              value={salaryCut}
              onChange={setSalaryCut}
              disabled={attendanceStatus === "leave" || saving || settling}
            />
          </div>

          <div
            className="mt-5 rounded-xl border p-4"
            style={{
              borderColor: colors.border,
              backgroundColor: colors.background,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p
                  className="text-xs"
                  style={{ color: colors.muted }}
                >
                  Today's earning
                </p>

                <p className="mt-1 text-lg font-semibold">
                  RM {formatMoney(todayEarning)}
                </p>
              </div>

              <div className="text-right">
                <p
                  className="text-[10px]"
                  style={{ color: colors.muted }}
                >
                  Salary + OT − Cut
                </p>

                <p
                  className="mt-1 text-xs"
                  style={{ color: colors.secondary }}
                >
                  RM {formatMoney(currentSalary)} + RM {formatMoney(currentOvertime)} − RM {formatMoney(currentSalaryCut)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Today's salary summary                                             */}
        {/* ---------------------------------------------------------------- */}

        <section
          className="mt-4 rounded-2xl border p-4"
          style={{
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: colors.text }}
              >
                Today's salary summary
              </p>

              <p
                className="mt-1 text-xs leading-5"
                style={{ color: colors.muted }}
              >
                Salary payment summary for {employee.name}.
              </p>
            </div>

            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{
                backgroundColor: settlementAlreadyRecorded
                  ? colors.accentSoft
                  : colors.background,
                color: paymentStatusColor,
              }}
            >
              {paymentStatusText}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <SummaryRow label="Base salary" value={currentSalary} />
            <SummaryRow label="Overtime" value={currentOvertime} />
            <SummaryRow label="Salary cut" value={-currentSalaryCut} negative />

            <div
              className="border-t pt-3"
              style={{ borderColor: colors.border }}
            >
              <SummaryRow
                label="Today's earning"
                value={todayEarning}
                strong
                positive={todayEarning > 0}
              />
            </div>

            <SummaryRow
              label="Outstanding after payment"
              value={outstandingAfterRecordedPayment}
              positive={outstandingAfterRecordedPayment > 0}
            />

            <SummaryRow
              label="Payment"
              value={settlementAlreadyRecorded ? existingSettlementAmount : 0}
              positive={settlementAlreadyRecorded}
            />

            <div
              className="rounded-xl border p-3.5"
              style={{
                borderColor: colors.border,
                backgroundColor: colors.background,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <span
                  className="text-xs"
                  style={{ color: colors.secondary }}
                >
                  Expense / payment date
                </span>

                <span className="text-sm font-medium">
                  {formatShortDate(settlementDate)}
                </span>
              </div>

              <p
                className="mt-1 text-[11px] leading-5"
                style={{ color: colors.muted }}
              >
                {selectedShift === "day"
                  ? "Day shift is recorded on the selected date."
                  : "Night shift is recorded on the following calendar date."}
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Actions                                                            */}
        {/* ---------------------------------------------------------------- */}

        <section className="mt-4">
          <button
            type="button"
            onClick={saveWithoutSettling}
            disabled={saving || settling}
            className="w-full rounded-xl border px-4 py-3.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: colors.border,
              backgroundColor: colors.surface,
              color: colors.text,
            }}
          >
            {saving ? "Saving..." : "Save without settling"}
          </button>

          <button
            type="button"
            onClick={openSettlementConfirmation}
            disabled={
              saving || settling || settlementAmount <= 0
            }
            className="mt-2 w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              backgroundColor: colors.accent,
              color: colors.text,
            }}
          >
            {settlementAlreadyRecorded
              ? `Update settlement · RM ${formatMoney(settlementAmount)}`
              : `Settle now · RM ${formatMoney(settlementAmount)}`}
          </button>

          <p
            className="mt-2 text-center text-[11px] leading-5"
            style={{ color: colors.muted }}
          >
            Save without settling records earnings only. Settlement records
            the payment on the displayed expense date.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Notes                                                              */}
        {/* ---------------------------------------------------------------- */}

        <section
          className="mt-6 rounded-2xl border"
          style={{
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-4"
            style={{ borderColor: colors.border }}
          >
            <div>
              <h2 className="text-sm font-semibold">Notes</h2>

              <p
                className="mt-1 text-xs"
                style={{ color: colors.muted }}
              >
                Notes for this date.
              </p>
            </div>

            <button
              type="button"
              onClick={openNoteModal}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
              style={{
                backgroundColor: colors.accentSoft,
                color: "#7DD3A8",
              }}
            >
              + Add note
            </button>
          </div>

          <div className="p-4">
            {notes.length === 0 ? (
              <p
                className="py-5 text-center text-xs"
                style={{ color: colors.muted }}
              >
                No notes for this date.
              </p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xl border p-3.5"
                    style={{
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    }}
                  >
                    <p className="text-sm font-medium">{note.title}</p>

                    <p
                      className="mt-1.5 whitespace-pre-wrap text-xs leading-5"
                      style={{ color: colors.secondary }}
                    >
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ================================================================== */}
      {/* Settlement confirmation modal                                      */}
      {/* ================================================================== */}

      {showSettlementModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          style={{
            paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl"
            style={{
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <div
              className="border-b px-5 py-4"
              style={{ borderColor: colors.border }}
            >
              <h2 className="text-base font-semibold">
                {settlementAlreadyRecorded
                  ? "Update salary settlement?"
                  : "Settle salary now?"}
              </h2>

              <p
                className="mt-1 text-xs"
                style={{ color: colors.muted }}
              >
                Work date: {formatShortDate(targetDate)}
              </p>
            </div>

            <div className="p-5">
              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor: "rgba(31, 122, 94, 0.35)",
                  backgroundColor: colors.accentSoft,
                }}
              >
                <p
                  className="text-xs leading-5"
                  style={{ color: colors.secondary }}
                >
                  {settlementAlreadyRecorded
                    ? "The existing salary settlement will be updated to:"
                    : "You are about to pay this employee:"}
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  RM {formatMoney(settlementAmount)}
                </p>
              </div>

              <div className="mt-4 space-y-3">
                <SettlementRow
                  label="Current balance before today's edit"
                  value={balance}
                />

                <SettlementRow
                  label="Today's earning"
                  value={todayEarning}
                  positive
                />

                <div
                  className="border-t pt-3"
                  style={{ borderColor: colors.border }}
                >
                  <SettlementRow
                    label="Total payment"
                    value={settlementAmount}
                    strong
                  />
                </div>

                <SettlementRow
                  label="Expense / payment date"
                  valueLabel={formatShortDate(settlementDate)}
                  strong
                />
              </div>

              <p
                className="mt-5 text-xs leading-5"
                style={{ color: colors.secondary }}
              >
                {settlementAlreadyRecorded
                  ? "This updates the existing settlement transaction. It will not create a new payment transaction for this employee's work date."
                  : "This will record the full amount as a payment on the expense date shown above. Make sure you have actually paid this employee before continuing."}
              </p>
            </div>

            <div
              className="flex gap-2 border-t p-4"
              style={{ borderColor: colors.border }}
            >
              <button
                type="button"
                onClick={() => setShowSettlementModal(false)}
                disabled={settling}
                className="flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition disabled:opacity-40"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  color: colors.secondary,
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={settleNow}
                disabled={settling}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:opacity-40"
                style={{
                  backgroundColor: colors.accent,
                  color: colors.text,
                }}
              >
                {settling
                  ? "Saving..."
                  : settlementAlreadyRecorded
                    ? "Confirm update"
                    : "Confirm & settle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Add note modal                                                      */}
      {/* ================================================================== */}

      {showNoteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          style={{
            paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border shadow-2xl"
            style={{
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <div
              className="flex items-start justify-between border-b px-5 py-4"
              style={{ borderColor: colors.border }}
            >
              <div>
                <h2 className="text-base font-semibold">Add note</h2>

                <p
                  className="mt-1 text-xs"
                  style={{ color: colors.muted }}
                >
                  {formatShortDate(targetDate)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeNoteModal}
                disabled={savingNote}
                className="text-lg transition disabled:opacity-30"
                style={{ color: colors.muted }}
              >
                ×
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label
                  className="mb-2 block text-xs font-medium"
                  style={{ color: colors.secondary }}
                >
                  Title
                </label>

                <input
                  type="text"
                  value={noteTitle}
                  onChange={(event) => setNoteTitle(event.target.value)}
                  placeholder="Note title"
                  className="w-full rounded-xl border px-3.5 py-3 text-sm outline-none"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    color: colors.text,
                  }}
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-xs font-medium"
                  style={{ color: colors.secondary }}
                >
                  Note
                </label>

                <textarea
                  value={noteContent}
                  onChange={(event) => setNoteContent(event.target.value)}
                  rows={5}
                  placeholder="Write a note about this date..."
                  className="w-full resize-none rounded-xl border px-3.5 py-3 text-sm outline-none"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    color: colors.text,
                  }}
                />
              </div>
            </div>

            <div
              className="flex justify-end gap-2 border-t px-5 py-4"
              style={{ borderColor: colors.border }}
            >
              <button
                type="button"
                onClick={closeNoteModal}
                disabled={savingNote}
                className="rounded-xl border px-4 py-2.5 text-sm transition disabled:opacity-30"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  color: colors.secondary,
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={createNote}
                disabled={savingNote}
                className="rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50"
                style={{
                  backgroundColor: colors.accent,
                  color: colors.text,
                }}
              >
                {savingNote ? "Saving..." : "Add note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ========================================================================== */
/* Components                                                                 */
/* ========================================================================== */

function MoneyInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        className="mb-2 block text-[11px] font-medium"
        style={{ color: colors.muted }}
      >
        {label}
      </label>

      <div className="relative">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
          style={{ color: colors.muted }}
        >
          RM
        </span>

        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0.00"
          disabled={disabled}
          className="w-full rounded-xl border py-2.5 pl-11 pr-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: colors.border,
            backgroundColor: colors.background,
            color: colors.text,
          }}
        />
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueLabel,
  positive = false,
  negative = false,
  strong = false,
}: {
  label: string;
  value?: number;
  valueLabel?: string;
  positive?: boolean;
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={`text-xs ${strong ? "font-medium" : ""}`}
        style={{ color: strong ? colors.text : colors.secondary }}
      >
        {label}
      </span>

      <span
        className={`text-sm ${strong ? "font-semibold" : "font-medium"}`}
        style={{
          color: negative
            ? colors.error
            : positive
              ? "#7DD3A8"
              : colors.text,
        }}
      >
        {valueLabel ?? `RM ${formatMoney(value ?? 0)}`}
      </span>
    </div>
  );
}

function SettlementRow({
  label,
  value,
  valueLabel,
  positive = false,
  strong = false,
}: {
  label: string;
  value?: number;
  valueLabel?: string;
  positive?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={`text-xs ${strong ? "font-medium" : ""}`}
        style={{ color: strong ? colors.text : colors.secondary }}
      >
        {label}
      </span>

      <span
        className={`text-sm ${strong ? "font-semibold" : "font-medium"}`}
        style={{ color: positive ? "#7DD3A8" : colors.text }}
      >
        {valueLabel ?? `RM ${formatMoney(value ?? 0)}`}
      </span>
    </div>
  );
}
