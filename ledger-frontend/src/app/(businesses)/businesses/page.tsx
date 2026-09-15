"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { sdk } from "@/lib/api";
import type { Business, BusinessType } from "@blacklane-ledger/sdk";

/**
 * Brand palette — same source/approximations as Sales, Expenses,
 * Employees, and Login. Border, accent, and error aren't given exact
 * hex on the brand sheet; keep all five files in sync if you land
 * exact values.
 */
const colors = {
  background: "#0B0F14",
  surface: "#1F2937",
  border: "rgba(156, 163, 175, 0.16)",
  text: "#FAFAFA",
  secondary: "#9CA3AF",
  muted: "#6B7280",
  accent: "#1F7A5C",
  accentSoft: "rgba(31, 122, 94, 0.14)",
  error: "#E08A6E",
  errorBackground: "rgba(224, 138, 110, 0.12)",
};

const businessTypeLabels: Record<BusinessType, string> = {
  restaurant: "Restaurant",
};

export default function BusinessesPage() {
  const router = useRouter();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddBusiness, setShowAddBusiness] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("restaurant");
  const [isCreating, setIsCreating] = useState(false);

  // -- Load businesses ------------------------------------------------------

  useEffect(() => {
    async function loadBusinesses() {
      const accessToken = localStorage.getItem("access_token");

      if (!accessToken) {
        router.replace("/login");
        return;
      }

      try {
        const data = await sdk.businesses.mine();
        setBusinesses(data);

        const savedBusinessId = localStorage.getItem("business_id");

        if (savedBusinessId && data.some((business) => business.id === savedBusinessId)) {
          setSelectedBusinessId(savedBusinessId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load your businesses.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadBusinesses();
  }, [router]);

  // -- Create business ---------------------------------------------------------

  async function handleCreateBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!businessName.trim()) {
      return;
    }

    setError("");
    setIsCreating(true);

    try {
      const business = await sdk.businesses.create({
        name: businessName.trim(),
        business_type: businessType,
      });

      setBusinesses((current) => [...current, business]);
      setSelectedBusinessId(business.id);
      localStorage.setItem("business_id", business.id);

      setBusinessName("");
      setBusinessType("restaurant");
      setShowAddBusiness(false);

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the business.");
    } finally {
      setIsCreating(false);
    }
  }

  function handleSelectBusiness(businessId: string) {
    setSelectedBusinessId(businessId);
    localStorage.setItem("business_id", businessId);
    router.push("/dashboard");
  }

  // ---------------------------------------------------------------------------

  return (
    <main
      className="min-h-screen px-4 py-8 sm:px-6 sm:py-12"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 sm:mb-10">
          <p
            className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: colors.accent }}
          >
            Workspace
          </p>

          <h1 className="text-[26px] font-bold tracking-tight sm:text-[30px]" style={{ color: colors.text }}>
            Select your business
          </h1>

          <p className="mt-2 max-w-lg text-[14px] leading-6" style={{ color: colors.secondary }}>
            Choose the business you want to manage.
          </p>
        </div>

        {error && (
          <div
            className="mb-5 rounded-lg px-4 py-3 text-[13px] leading-5"
            style={{ backgroundColor: colors.errorBackground, color: colors.error }}
          >
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            <div className="h-[78px] animate-pulse rounded-xl" style={{ backgroundColor: colors.surface }} />
            <div className="h-[78px] animate-pulse rounded-xl" style={{ backgroundColor: colors.surface }} />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && businesses.length === 0 && !showAddBusiness && (
          <div
            className="rounded-xl border px-5 py-10 text-center sm:px-10"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border"
              style={{ borderColor: colors.border, color: colors.accent }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h2 className="mt-5 text-[16px] font-semibold" style={{ color: colors.text }}>
              No business yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-[13px] leading-5" style={{ color: colors.secondary }}>
              Add your business to start managing sales, expenses, employees, and your ledger.
            </p>

            <button
              type="button"
              onClick={() => setShowAddBusiness(true)}
              className="mt-6 h-12 w-full rounded-lg px-6 text-[13px] font-semibold transition-opacity hover:opacity-90 active:scale-[0.98] sm:w-auto"
              style={{ backgroundColor: colors.accent, color: colors.text }}
            >
              Add a business
            </button>
          </div>
        )}

        {/* Add-business form */}
        {!isLoading && showAddBusiness && (
          <div
            className="rounded-xl border p-5 shadow-lg sm:p-7"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <div className="mb-6">
              <h2 className="text-[18px] font-semibold" style={{ color: colors.text }}>
                Add a business
              </h2>
              <p className="mt-1.5 text-[13px] leading-5" style={{ color: colors.secondary }}>
                Enter the business details to get started.
              </p>
            </div>

            <form onSubmit={handleCreateBusiness} className="space-y-5">
              <div>
                <label
                  htmlFor="business-name"
                  className="mb-2 block text-[13px] font-medium"
                  style={{ color: colors.text }}
                >
                  Business name
                </label>

                <input
                  id="business-name"
                  type="text"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder="e.g. Blacklane Restaurant"
                  required
                  autoComplete="organization"
                  className="h-12 w-full rounded-lg border px-4 text-base outline-none transition-colors focus:border-[#1F7A5C]"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="business-type"
                  className="mb-2 block text-[13px] font-medium"
                  style={{ color: colors.text }}
                >
                  Business type
                </label>

                <select
                  id="business-type"
                  value={businessType}
                  onChange={(event) => setBusinessType(event.target.value as BusinessType)}
                  className="h-12 w-full rounded-lg border px-4 text-base outline-none transition-colors focus:border-[#1F7A5C]"
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                >
                  <option value="restaurant">Restaurant</option>
                </select>

                <p className="mt-2 text-[11px]" style={{ color: colors.muted }}>
                  The available workflow depends on the business type.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isCreating || !businessName.trim()}
                  className="h-12 w-full rounded-lg px-6 text-[13px] font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ backgroundColor: colors.accent, color: colors.text }}
                >
                  {isCreating ? "Creating…" : "Create business"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAddBusiness(false);
                    setBusinessName("");
                    setBusinessType("restaurant");
                  }}
                  className="h-12 w-full rounded-lg border px-6 text-[13px] font-medium transition-opacity hover:opacity-80"
                  style={{ borderColor: colors.border, color: colors.secondary }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Business list */}
        {!isLoading && !error && businesses.length > 0 && !showAddBusiness && (
          <>
            <div className="space-y-3">
              {businesses.map((business) => {
                const isSelected = selectedBusinessId === business.id;

                return (
                  <button
                    key={business.id}
                    type="button"
                    onClick={() => handleSelectBusiness(business.id)}
                    className="flex min-h-[78px] w-full items-center justify-between rounded-xl border px-4 py-4 text-left transition-all active:scale-[0.99] sm:px-5"
                    style={{
                      backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.border,
                    }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold sm:text-[16px]" style={{ color: colors.text }}>
                        {business.name}
                      </p>
                      <p className="mt-1 text-[12px]" style={{ color: colors.secondary }}>
                        {businessTypeLabels[business.business_type]}
                      </p>
                    </div>

                    <span
                      className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        borderColor: isSelected ? colors.accent : colors.muted,
                        backgroundColor: isSelected ? colors.accent : "transparent",
                      }}
                      aria-hidden="true"
                    >
                      {isSelected ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M5 12.5L9.5 17L19 7.5"
                            stroke={colors.text}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.muted }} />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowAddBusiness(true)}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-lg border text-[13px] font-medium transition-opacity hover:opacity-80"
              style={{ borderColor: colors.border, color: colors.secondary }}
            >
              + Add business
            </button>
          </>
        )}

        <p className="mt-10 text-center text-[11px]" style={{ color: colors.muted }}>
          Powered by blacklane
        </p>
      </div>
    </main>
  );
}