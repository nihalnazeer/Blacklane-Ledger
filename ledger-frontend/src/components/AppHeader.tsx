"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Brand palette — same source/approximations as every other page
 * (Sales, Expenses, Employees, Login, Businesses). Border and error
 * aren't given exact hex on the brand sheet; the accent green below
 * is read directly off the sheet's swatch. Keep all files in sync if
 * you land more precise values.
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
};

function NavIcon({ name }: { name: string }): ReactNode {
  const shared = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...shared}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case "sales":
      return (
        <svg {...shared}>
          <path
            d="M3.5 19.5V4.5M3.5 19.5H20.5M7.5 16V12M11.5 16V8.5M15.5 16V10.5M19.5 16V6.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "expenses":
      return (
        <svg {...shared}>
          <path
            d="M6 3.5h12v17l-2.5-1.7-2.5 1.7-2.5-1.7-2.5 1.7-2-1.7V3.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "employees":
      return (
        <svg {...shared}>
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M3.5 19c.6-3.2 3-5 5.5-5s4.9 1.8 5.5 5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="17" cy="7.5" r="2.3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M15.7 12c2 .1 3.9 1.6 4.4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "reports":
      return (
        <svg {...shared}>
          <rect x="4.5" y="3.5" width="15" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 14.5V16.5M12 11.5V16.5M16 8.5V16.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "settings":
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7 6.3 6.3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

const navigation = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "sales", label: "Sales", href: "/sales" },
  { key: "expenses", label: "Expenses", href: "/expenses" },
  { key: "employees", label: "Employees", href: "/employees" },
  { key: "reports", label: "Reports", href: "/reports" },
  { key: "settings", label: "Settings", href: "/settings" },
];

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  function isActivePath(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function handleSignOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("business_id");
    router.replace("/login");
  }

  return (
    <>
      {/* Top bar — logo, desktop nav, account actions */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur supports-[backdrop-filter]:bg-opacity-90"
        style={{ backgroundColor: colors.background, borderColor: colors.border }}
      >
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo — same badge as the Login page, "blacklane. | ledger" lockup */}
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-3 transition-opacity hover:opacity-85"
            aria-label="Blacklane Ledger dashboard"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[19px] font-extrabold lowercase shadow-lg"
              style={{ backgroundColor: colors.text, color: colors.background }}
            >
              b<span style={{ color: colors.accent }}>.</span>
            </span>

            <span className="flex items-center gap-3">
              <span
                className="text-[21px] font-extrabold lowercase tracking-tight"
                style={{ color: colors.text }}
              >
                blacklane
                <span style={{ color: colors.accent }}>.</span>
              </span>

              <span
                className="hidden h-5 w-px sm:block"
                style={{ backgroundColor: colors.border }}
                aria-hidden="true"
              />

              <span
                className="hidden text-[14px] font-medium lowercase tracking-wide sm:inline"
                style={{ color: colors.secondary }}
              >
                ledger
              </span>
            </span>
          </button>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {navigation.map((item) => {
              const active = isActivePath(item.href);

              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className="flex items-center gap-1.5 rounded-md px-3.5 py-2.5 text-[13.5px] font-medium transition-colors"
                  style={{
                    color: active ? colors.accent : colors.secondary,
                    backgroundColor: active ? colors.accentSoft : "transparent",
                  }}
                >
                  <NavIcon name={item.key} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/businesses")}
              className="hidden rounded-md border px-3.5 py-2.5 text-[12.5px] font-medium transition-opacity hover:opacity-75 sm:block"
              style={{ borderColor: colors.border, color: colors.secondary }}
            >
              Switch business
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md px-3.5 py-2.5 text-[12.5px] font-medium transition-opacity hover:opacity-75"
              style={{ color: colors.secondary }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur md:hidden"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${navigation.length}, minmax(0, 1fr))`,
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {navigation.map((item) => {
            const active = isActivePath(item.href);

            return (
              <button
                key={item.href}
                type="button"
                onClick={() => router.push(item.href)}
                className="flex min-h-[68px] flex-col items-center justify-center gap-1.5 py-3 transition-colors"
                style={{ color: active ? colors.accent : colors.secondary }}
              >
                <NavIcon name={item.key} />
                <span className="text-[11px] font-medium leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}