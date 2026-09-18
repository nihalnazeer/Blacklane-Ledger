"use client";

import { useState, type FormEvent } from "react";
import { sdk } from "@/lib/api";

const colors = {
  background: "#0B0F14",
  surface: "#1F2937",
  border: "rgba(156, 163, 175, 0.16)",
  text: "#FAFAFA",
  secondary: "#9CA3AF",
  muted: "#6B7280",
  accent: "#1F7A5C",
  error: "#E08A6E",
  errorBackground: "rgba(224, 138, 110, 0.12)",
};

export default function SignupPage() {
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("restaurant");
  const [isBusinessTypeOpen, setIsBusinessTypeOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      const tokens = await sdk.auth.signup({
        email,
        password,
        business_name: businessName,
        business_type: businessType as "restaurant",
      });

      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);

      window.location.href = "/businesses";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create your account.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main
      className="min-h-dvh px-3 py-3 sm:px-5 sm:py-5"
      style={{
        backgroundColor: colors.background,
      }}
    >
      <style>{`
        @keyframes bl-signup-fade {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bl-signup-glow {
          0%, 100% {
            opacity: 0.32;
            transform: translate(0, 0) scale(1);
          }

          50% {
            opacity: 0.48;
            transform: translate(-12px, 8px) scale(1.05);
          }
        }

        .bl-signup-fade {
          animation:
            bl-signup-fade
            0.55s
            cubic-bezier(0.16, 1, 0.3, 1)
            both;
        }
      `}</style>

      <div
        className="mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl sm:min-h-[calc(100dvh-2.5rem)] lg:flex-row"
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Onboarding panel                                                  */}
        {/* ---------------------------------------------------------------- */}

        <section
          className="relative flex min-h-[330px] w-full flex-col overflow-hidden lg:min-h-0 lg:w-[48%] lg:justify-between"
          style={{
            backgroundColor: colors.accent,
          }}
        >
          {/* Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(108,221,174,0.38) 0%, transparent 68%)",
              filter: "blur(45px)",
              animation: "bl-signup-glow 7s ease-in-out infinite",
            }}
          />

          {/* Grid */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(
                  rgba(255,255,255,0.07) 1px,
                  transparent 1px
                ),
                linear-gradient(
                  90deg,
                  rgba(255,255,255,0.07) 1px,
                  transparent 1px
                )
              `,
              backgroundSize: "42px 42px",
              maskImage:
                "linear-gradient(to bottom, black, transparent 90%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, black, transparent 90%)",
              opacity: 0.42,
            }}
          />

          {/* Brand + message */}
          <div className="relative z-10 p-6 sm:p-8 lg:p-10 xl:p-12">
            <a
              href="/login"
              className="inline-flex items-baseline text-[20px] font-extrabold lowercase tracking-tight"
              style={{ color: colors.text }}
            >
              blacklane
              <span style={{ color: "#A8E5CB" }}>.</span>
            </a>

            <p
              className="mt-0.5 text-[9px] font-medium lowercase tracking-[0.22em]"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              ledger
            </p>

            <div className="mt-10 max-w-[440px] sm:mt-12 lg:mt-[22vh]">
              <p
                className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] sm:mb-5 sm:text-[11px]"
                style={{ color: "rgba(255,255,255,0.62)" }}
              >
                Blacklane Ledger
              </p>

              <h1
                className="text-3xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-4xl lg:text-4xl xl:text-[46px]"
                style={{ color: colors.text }}
              >
                Get started
                <br className="hidden sm:block" />
                <span className="sm:hidden"> </span>
                with us.
              </h1>

              <p
                className="mt-3 max-w-[390px] text-xs leading-5 sm:mt-5 sm:text-sm sm:leading-6"
                style={{ color: "rgba(255,255,255,0.68)" }}
              >
                Set up your business once. Then keep your sales,
                expenses, employees and reports in one place.
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="relative z-10 px-6 pb-6 sm:px-8 sm:pb-8 lg:px-10 lg:pb-10 xl:px-12 xl:pb-12">
            <div className="mb-3 flex items-center justify-between sm:mb-4">
              <p
                className="text-[10px] font-medium sm:text-[11px]"
                style={{ color: "rgba(255,255,255,0.68)" }}
              >
                Account setup
              </p>

              <p
                className="text-[10px] sm:text-[11px]"
                style={{ color: "rgba(255,255,255,0.52)" }}
              >
                Step 1 of 3
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <div
                className="rounded-lg p-2.5 sm:rounded-xl sm:p-4"
                style={{
                  backgroundColor: "rgba(255,255,255,0.96)",
                  color: colors.background,
                }}
              >
                <div
                  className="mb-2 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold sm:mb-4 sm:h-6 sm:w-6 sm:text-[10px]"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.text,
                  }}
                >
                  1
                </div>

                <p className="text-[9px] font-semibold leading-4 sm:text-[11px] sm:leading-normal">
                  Create your
                  <br />
                  account
                </p>
              </div>

              <div
                className="rounded-lg p-2.5 sm:rounded-xl sm:p-4"
                style={{
                  backgroundColor: "rgba(255,255,255,0.12)",
                  color: colors.text,
                }}
              >
                <div
                  className="mb-2 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-medium sm:mb-4 sm:h-6 sm:w-6 sm:text-[10px]"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.65)",
                  }}
                >
                  2
                </div>

                <p
                  className="text-[9px] font-medium leading-4 sm:text-[11px] sm:leading-normal"
                  style={{ color: "rgba(255,255,255,0.72)" }}
                >
                  Set up your
                  <br />
                  business
                </p>
              </div>

              <div
                className="rounded-lg p-2.5 sm:rounded-xl sm:p-4"
                style={{
                  backgroundColor: "rgba(255,255,255,0.12)",
                  color: colors.text,
                }}
              >
                <div
                  className="mb-2 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-medium sm:mb-4 sm:h-6 sm:w-6 sm:text-[10px]"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.65)",
                  }}
                >
                  3
                </div>

                <p
                  className="text-[9px] font-medium leading-4 sm:text-[11px] sm:leading-normal"
                  style={{ color: "rgba(255,255,255,0.72)" }}
                >
                  Start managing
                  <br />
                  your ledger
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Signup panel                                                       */}
        {/* ---------------------------------------------------------------- */}

        <section
          className="relative flex w-full items-center justify-center lg:w-[52%]"
          style={{
            backgroundColor: colors.background,
          }}
        >
          <div
            className="bl-signup-fade w-full max-w-[440px] px-5 py-7 sm:px-8 sm:py-8 lg:px-12"
            style={{
              animationDelay: "0.05s",
            }}
          >
            {/* Mobile brand */}
            <div className="mb-7 lg:hidden">
              <a
                href="/login"
                className="inline-flex items-baseline text-[19px] font-extrabold lowercase tracking-tight"
                style={{ color: colors.text }}
              >
                blacklane
                <span style={{ color: colors.accent }}>.</span>
              </a>

              <p
                className="mt-0.5 text-[9px] font-medium lowercase tracking-[0.22em]"
                style={{ color: colors.secondary }}
              >
                ledger
              </p>
            </div>

            {/* Heading */}
            <div className="text-center">
              <h2
                className="text-[21px] font-semibold tracking-tight sm:text-[23px]"
                style={{ color: colors.text }}
              >
                Create your account
              </h2>

              <p
                className="mt-2 text-[12px] leading-5"
                style={{ color: colors.secondary }}
              >
                Set up your account to get started.
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-3.5"
              noValidate
            >
              {/* Business name */}
              <div>
                <label
                  htmlFor="businessName"
                  className="mb-1.5 block text-[11px] font-medium"
                  style={{ color: colors.text }}
                >
                  Business name
                </label>

                <input
                  id="businessName"
                  type="text"
                  value={businessName}
                  onChange={(event) =>
                    setBusinessName(event.target.value)
                  }
                  autoComplete="organization"
                  placeholder="e.g. Blacklane Restaurant"
                  required
                  className="h-11 w-full rounded-md border px-3.5 text-[13px] outline-none transition-colors placeholder:opacity-35"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                />
              </div>

              {/* Business type */}
              <div>
                <label
                  htmlFor="businessType"
                  className="mb-1.5 block text-[11px] font-medium"
                  style={{ color: colors.text }}
                >
                  Business type
                </label>

                <div className="relative">
                  <button
                    id="businessType"
                    type="button"
                    onClick={() =>
                      setIsBusinessTypeOpen(
                        (current) => !current,
                      )
                    }
                    aria-haspopup="listbox"
                    aria-expanded={isBusinessTypeOpen}
                    className="flex h-11 w-full items-center justify-between rounded-md border px-3.5 text-left text-[13px] outline-none transition-colors"
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: isBusinessTypeOpen
                        ? colors.accent
                        : colors.border,
                      color: colors.text,
                    }}
                  >
                    <span>Restaurant</span>

                    <span
                      aria-hidden="true"
                      className={`text-xs transition-transform duration-150 ${
                        isBusinessTypeOpen
                          ? "rotate-180"
                          : ""
                      }`}
                      style={{
                        color: colors.secondary,
                      }}
                    >
                      ▾
                    </span>
                  </button>

                  {isBusinessTypeOpen && (
                    <div
                      role="listbox"
                      aria-label="Business type"
                      className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-md border p-1 shadow-xl"
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      }}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={businessType === "restaurant"}
                        onClick={() => {
                          setBusinessType("restaurant");
                          setIsBusinessTypeOpen(false);
                        }}
                        className="flex h-10 w-full items-center justify-between rounded px-3 text-left text-[12px] font-medium transition-opacity hover:opacity-80"
                        style={{
                          backgroundColor:
                            businessType === "restaurant"
                              ? "rgba(31, 122, 94, 0.16)"
                              : "transparent",
                          color: colors.text,
                        }}
                      >
                        <span>Restaurant</span>

                        {businessType === "restaurant" && (
                          <span
                            aria-hidden="true"
                            style={{
                              color: colors.accent,
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[11px] font-medium"
                  style={{ color: colors.text }}
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="e.g. owner@business.com"
                  required
                  className="h-11 w-full rounded-md border px-3.5 text-[13px] outline-none transition-colors placeholder:opacity-35"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-[11px] font-medium"
                  style={{ color: colors.text }}
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    autoComplete="new-password"
                    placeholder="Enter your password"
                    required
                    minLength={8}
                    className="h-11 w-full rounded-md border px-3.5 pr-16 text-[13px] outline-none transition-colors placeholder:opacity-35"
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    }}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium transition-opacity hover:opacity-70"
                    style={{
                      color: colors.secondary,
                    }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                <p
                  className="mt-1.5 text-[10px]"
                  style={{ color: colors.muted }}
                >
                  Must be at least 8 characters.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="rounded-md px-3.5 py-2.5 text-[12px] leading-5"
                  style={{
                    backgroundColor: colors.errorBackground,
                    border: `1px solid ${colors.error}33`,
                    color: colors.error,
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="mt-1 h-11 w-full rounded-md text-[12px] font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: colors.text,
                  color: colors.background,
                }}
              >
                {isLoading
                  ? "Creating account…"
                  : "Create account"}
              </button>
            </form>

            {/* Sign in */}
            <div className="mt-6 text-center">
              <span
                className="text-[11px]"
                style={{ color: colors.muted }}
              >
                Already have an account?{" "}
              </span>

              <a
                href="/login"
                className="text-[11px] font-medium transition-opacity hover:opacity-70"
                style={{ color: colors.text }}
              >
                Sign in
              </a>
            </div>

            {/* Footer */}
            <p
              className="mt-6 text-center text-[10px]"
              style={{ color: colors.muted }}
            >
              Blacklane Ledger
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}