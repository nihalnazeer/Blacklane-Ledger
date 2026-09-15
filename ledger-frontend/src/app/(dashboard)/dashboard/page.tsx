"use client";

import { useEffect, useState } from "react";
import { sdk } from "@/lib/api";

type Dashboard = Awaited<ReturnType<typeof sdk.dashboard.get>>;

const colors = {
  background: "#0B0F14",
  surface: "#1F2937",
  border: "rgba(156, 163, 175, 0.16)",
  text: "#FAFAFA",
  secondary: "#9CA3AF",
  accent: "#1F7A5C",
  accentSoft: "rgba(31, 122, 94, 0.16)",
  error: "#E08A6E",
  errorBackground: "rgba(224, 138, 110, 0.12)",
};

function formatCurrency(value: string | number) {
  const amount = Number(value);
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function isPositive(value: string | number) {
  return Number(value) >= 0;
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [businessName, setBusinessName] = useState("your business");
  const [userName, setUserName] = useState("there");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        const businessId = localStorage.getItem("business_id");

        if (!businessId) {
          throw new Error("Business not found.");
        }

        const [dashboardData, currentUser, businesses] = await Promise.all([
  sdk.dashboard.get(businessId),
  sdk.auth.me(),
  sdk.businesses.mine(),
]);

const business = businesses.find(
  (item) => item.id === businessId,
);

        if (!mounted) return;

        setDashboard(dashboardData);

        if (currentUser?.email) {
          setUserName(currentUser.email.split("@")[0]);
        }

        if (business?.name) {
          setBusinessName(business.name);
        }
      } catch (err) {
        if (!mounted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the dashboard.",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <main
        className="min-h-screen px-5 py-8 pb-28"
        style={{ backgroundColor: colors.background, color: colors.text }}
      >
        <div className="mx-auto max-w-3xl">
          <div
            className="h-7 w-44 animate-pulse rounded-lg"
            style={{ backgroundColor: colors.surface }}
          />
          <div
            className="mt-3 h-4 w-64 animate-pulse rounded"
            style={{ backgroundColor: colors.surface }}
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-32 animate-pulse rounded-2xl border"
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !dashboard) {
    return (
      <main
        className="min-h-screen px-5 py-8 pb-28"
        style={{ backgroundColor: colors.background, color: colors.text }}
      >
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <div
            className="mt-6 rounded-2xl border p-5"
            style={{
              backgroundColor: colors.errorBackground,
              borderColor: "rgba(224, 138, 110, 0.25)",
            }}
          >
            <p className="text-sm" style={{ color: colors.error }}>
              {error ?? "Unable to load the dashboard."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const todayBalancePositive = isPositive(dashboard.today.balance);
  const monthBalancePositive = isPositive(dashboard.month_to_date.balance);

  return (
    <main
      className="min-h-screen px-5 py-8 pb-28"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      <div className="mx-auto w-full max-w-3xl">
        <header>
          <p className="text-sm font-medium" style={{ color: colors.secondary }}>
            {formatDate(dashboard.date)}
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Welcome, {userName}
          </h1>

          <p className="mt-2 text-sm" style={{ color: colors.secondary }}>
            Here&apos;s how {businessName} is doing today.
          </p>
        </header>

        <section className="mt-7">
          <div
            className="rounded-3xl border p-6"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium" style={{ color: colors.secondary }}>
                  Today&apos;s balance
                </p>
                <p
                  className="mt-2 text-4xl font-semibold tracking-tight"
                  style={{
                    color: todayBalancePositive ? colors.accent : colors.error,
                  }}
                >
                  {formatCurrency(dashboard.today.balance)}
                </p>
              </div>

              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  backgroundColor: dashboard.today.has_data
                    ? colors.accentSoft
                    : "rgba(156, 163, 175, 0.10)",
                  color: dashboard.today.has_data
                    ? colors.accent
                    : colors.secondary,
                }}
              >
                {dashboard.today.has_data ? "Today" : "No data yet"}
              </span>
            </div>

            <div
              className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4"
              style={{ borderColor: colors.border }}
            >
              <Metric label="Cash sales" value={formatCurrency(dashboard.today.cash_sales)} />
              <Metric label="Expenses" value={formatCurrency(dashboard.today.total_expenses)} />
              <Metric
                label="Employee salary"
                value={formatCurrency(dashboard.today.employee_salary)}
              />
              <Metric label="Overtime" value={formatCurrency(dashboard.today.overtime)} />
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: colors.secondary }}>
                Month to date
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {dashboard.month_to_date.month_name}
              </h2>
            </div>

            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: dashboard.month_status.is_closed
                  ? colors.accentSoft
                  : "rgba(156, 163, 175, 0.10)",
                color: dashboard.month_status.is_closed
                  ? colors.accent
                  : colors.secondary,
              }}
            >
              {dashboard.month_status.is_closed ? "Closed" : "Open"}
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Cash sales"
              value={formatCurrency(dashboard.month_to_date.cash_sales)}
            />
            <MetricCard
              label="Total expenses"
              value={formatCurrency(dashboard.month_to_date.total_expenses)}
            />
            <MetricCard
              label="Employee salary"
              value={formatCurrency(dashboard.month_to_date.employee_salary)}
            />
            <MetricCard
              label="Cash balance"
              value={formatCurrency(dashboard.month_to_date.balance)}
              valueColor={monthBalancePositive ? colors.accent : colors.error}
            />
          </div>
        </section>

        <section className="mt-6">
          <div
            className="flex items-center justify-between rounded-2xl border px-5 py-4"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: colors.text }}>
                Employees
              </p>
              <p className="mt-1 text-xs" style={{ color: colors.secondary }}>
                Active employees
              </p>
            </div>
            <p className="text-2xl font-semibold">{dashboard.employees.count}</p>
          </div>
        </section>

        <section className="mt-6">
          <p className="text-sm font-medium" style={{ color: colors.secondary }}>
            Quick actions
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickAction href="/sales" label="Add sale" />
            <QuickAction href="/expenses" label="Add expense" />
            <QuickAction href="/employees" label="Employees" />
            <QuickAction href="/reports" label="Reports" />
          </div>
        </section>

        {!dashboard.month_status.is_closed && (
          <section className="mt-6">
            <div
              className="rounded-2xl border px-5 py-4"
              style={{
                backgroundColor: colors.accentSoft,
                borderColor: "rgba(31, 122, 94, 0.28)",
              }}
            >
              <p className="text-sm font-medium" style={{ color: colors.text }}>
                Month is still open
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: colors.secondary }}>
                Continue recording your sales and expenses. Close the month when your
                records are complete.
              </p>
            </div>
          </section>
        )}
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
          <BottomNavItem href="/dashboard" label="Dashboard" active />
          <BottomNavItem href="/sales" label="Sales" />
          <BottomNavItem href="/expenses" label="Expenses" />
          <BottomNavItem href="/reports" label="Reports" />
        </div>
      </nav>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: colors.secondary }}>
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  valueColor = colors.text,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
      }}
    >
      <p className="text-sm" style={{ color: colors.secondary }}>
        {label}
      </p>
      <p
        className="mt-2 text-2xl font-semibold tracking-tight"
        style={{ color: valueColor }}
      >
        {value}
      </p>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-2xl border px-4 py-4 text-center text-sm font-medium transition-opacity hover:opacity-80"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        color: colors.text,
      }}
    >
      {label}
    </a>
  );
}

function BottomNavItem({
  href,
  label,
  active = false,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-center text-xs font-medium"
      style={{ color: active ? colors.accent : colors.secondary }}
    >
      {label}
    </a>
  );
}
