"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function SettingsPage() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        setError("");

        const businessId = localStorage.getItem("business_id");

        const [user, businesses] = await Promise.all([
          sdk.auth.me(),
          sdk.businesses.mine(),
        ]);

        setUserEmail(user.email ?? "");
        setUserRole(user.role ?? "");

        if (businessId) {
          const business = businesses.find(
            (item) => item.id === businessId,
          );

          if (business) {
            setBusinessName(business.name);
            setBusinessType(business.business_type);
          }
        }
      } catch (err) {
        console.error("Failed to load settings", err);
        setError("Unable to load your account details.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function handleSignOut() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("business_id");

    router.push("/login");
  }

  function formatBusinessType(type: string) {
    if (!type) return "Restaurant";

    return type
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  const initials = userEmail
    ? userEmail.charAt(0).toUpperCase()
    : "U";

  return (
    <main
      className="min-h-screen px-4 pt-6 text-white sm:px-6"
      style={{
        backgroundColor: colors.background,
        color: colors.text,
      }}
    >
      <div className="mx-auto w-full max-w-3xl pb-28">
        {/* Page title */}
        <div className="mb-7">
          <p
            className="mb-1 text-sm"
            style={{ color: colors.secondary }}
          >
            Account
          </p>

          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ color: colors.text }}
          >
            Settings
          </h1>

          <p
            className="mt-2 text-sm"
            style={{ color: colors.muted }}
          >
            Manage your account and business preferences
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-5 rounded-2xl border px-4 py-3 text-sm"
            style={{
              backgroundColor: colors.errorBackground,
              borderColor: "rgba(224, 138, 110, 0.25)",
              color: colors.error,
            }}
          >
            {error}
          </div>
        )}

        {/* Profile */}
        <section className="mb-5">
          <div
            className="mb-3 text-xs font-medium uppercase tracking-wider"
            style={{ color: colors.muted }}
          >
            Profile
          </div>

          <div
            className="rounded-2xl border p-5"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            {loading ? (
              <div className="space-y-4">
                <div
                  className="h-12 w-12 animate-pulse rounded-full"
                  style={{ backgroundColor: colors.border }}
                />

                <div className="space-y-2">
                  <div
                    className="h-4 w-40 animate-pulse rounded"
                    style={{ backgroundColor: colors.border }}
                  />

                  <div
                    className="h-3 w-56 animate-pulse rounded"
                    style={{ backgroundColor: colors.border }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
                  style={{
                    backgroundColor: colors.accentSoft,
                    color: colors.accent,
                  }}
                >
                  {initials}
                </div>

                <div className="min-w-0">
                  <p
                    className="truncate text-base font-medium"
                    style={{ color: colors.text }}
                  >
                    {userEmail || "User"}
                  </p>

                  <p
                    className="mt-1 text-sm"
                    style={{ color: colors.secondary }}
                  >
                    {userRole
                      ? userRole
                          .toLowerCase()
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (letter) =>
                            letter.toUpperCase(),
                          )
                      : "Account"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Business */}
        <section className="mb-5">
          <div
            className="mb-3 text-xs font-medium uppercase tracking-wider"
            style={{ color: colors.muted }}
          >
            Business
          </div>

          <div
            className="overflow-hidden rounded-2xl border"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <div className="p-5">
              <p
                className="mb-1 text-xs"
                style={{ color: colors.muted }}
              >
                Business name
              </p>

              <p
                className="text-base font-medium"
                style={{ color: colors.text }}
              >
                {loading
                  ? "Loading..."
                  : businessName || "No business selected"}
              </p>
            </div>

            <div
              className="border-t p-5"
              style={{ borderColor: colors.border }}
            >
              <p
                className="mb-1 text-xs"
                style={{ color: colors.muted }}
              >
                Business type
              </p>

              <p
                className="text-base font-medium"
                style={{ color: colors.text }}
              >
                {loading
                  ? "Loading..."
                  : formatBusinessType(businessType)}
              </p>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="mb-5">
          <div
            className="mb-3 text-xs font-medium uppercase tracking-wider"
            style={{ color: colors.muted }}
          >
            Preferences
          </div>

          <div
            className="rounded-2xl border"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: colors.text }}
                >
                  Currency
                </p>

                <p
                  className="mt-1 text-xs"
                  style={{ color: colors.muted }}
                >
                  Default business currency
                </p>
              </div>

              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  backgroundColor: colors.accentSoft,
                  color: colors.accent,
                }}
              >
                MYR
              </span>
            </div>

            <div
              className="border-t px-5 py-4"
              style={{ borderColor: colors.border }}
            >
              <p
                className="text-sm font-medium"
                style={{ color: colors.text }}
              >
                More settings
              </p>

              <p
                className="mt-1 text-xs"
                style={{ color: colors.muted }}
              >
                Additional preferences will be available here.
              </p>
            </div>
          </div>
        </section>

        {/* Account */}
        <section>
          <div
            className="mb-3 text-xs font-medium uppercase tracking-wider"
            style={{ color: colors.muted }}
          >
            Account
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-opacity hover:opacity-80"
              style={{
                backgroundColor: colors.errorBackground,
                color: colors.error,
              }}
            >
              Sign out
            </button>
          </div>
        </section>
      </div>

      {/* Bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="mx-auto grid h-16 w-full max-w-3xl grid-cols-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex flex-col items-center justify-center gap-1 text-xs"
            style={{ color: colors.secondary }}
          >
            <span className="text-lg">⌂</span>
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/sales")}
            className="flex flex-col items-center justify-center gap-1 text-xs"
            style={{ color: colors.secondary }}
          >
            <span className="text-lg">₊</span>
            <span>Sales</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/employees")}
            className="flex flex-col items-center justify-center gap-1 text-xs"
            style={{ color: colors.secondary }}
          >
            <span className="text-lg">♙</span>
            <span>Employees</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="flex flex-col items-center justify-center gap-1 text-xs"
            style={{ color: colors.accent }}
          >
            <span className="text-lg">⚙</span>
            <span>Settings</span>
          </button>
        </div>
      </nav>
    </main>
  );
}