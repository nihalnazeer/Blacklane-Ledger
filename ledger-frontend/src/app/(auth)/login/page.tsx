"use client";

import { useState, type FormEvent } from "react";
import { sdk } from "@/lib/api";

/**
 * Blacklane Ledger — authentication palette.
 */
const colors = {
  background: "#0B0F14",
  surface: "#1F2937",
  border: "rgba(156, 163, 175, 0.16)",
  text: "#FAFAFA",
  secondary: "#9CA3AF",
  muted: "#6B7280",
  accent: "#1F7A5C",
  accentLight: "#2B9270",
  error: "#E08A6E",
  errorBackground: "rgba(224, 138, 110, 0.12)",
};

export default function LoginPage() {
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
      const tokens = await sdk.auth.login({
        email,
        password,
      });

      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);

      window.location.href = "/businesses";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in.",
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
        @keyframes bl-login-fade {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bl-login-glow {
          0%, 100% {
            opacity: 0.28;
            transform: scale(1);
          }

          50% {
            opacity: 0.42;
            transform: scale(1.06);
          }
        }

        .bl-login-fade {
          animation:
            bl-login-fade
            0.55s
            cubic-bezier(0.16, 1, 0.3, 1)
            both;
        }
      `}</style>

      <div
        className="mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-[1050px] flex-col overflow-hidden rounded-2xl sm:min-h-[calc(100dvh-2.5rem)] lg:min-h-[calc(100dvh-2.5rem)] lg:flex-row"
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Brand / welcome panel                                             */}
        {/* ---------------------------------------------------------------- */}

        <section
          className="relative flex min-h-[230px] w-full flex-col overflow-hidden lg:min-h-0 lg:w-[45%] lg:justify-between"
          style={{
            backgroundColor: colors.accent,
          }}
        >
          {/* Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-28 -top-28 h-[360px] w-[360px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(108,221,174,0.38) 0%, transparent 68%)",
              filter: "blur(45px)",
              animation: "bl-login-glow 7s ease-in-out infinite",
            }}
          />

          {/* Subtle grid */}
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
              backgroundSize: "40px 40px",
              maskImage:
                "linear-gradient(to bottom, black, transparent 90%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, black, transparent 90%)",
              opacity: 0.4,
            }}
          />

          {/* Brand */}
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

            {/* Welcome message */}
            <div className="mt-9 max-w-[390px] sm:mt-10 lg:mt-[22vh]">
              <p
                className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-[11px]"
                style={{ color: "rgba(255,255,255,0.62)" }}
              >
                Blacklane Ledger
              </p>

              <h1
                className="text-3xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-4xl xl:text-[44px]"
                style={{ color: colors.text }}
              >
                Your business,
                <br />
                in control.
              </h1>

              <p
                className="mt-3 max-w-[360px] text-xs leading-5 sm:mt-4 sm:text-sm sm:leading-6"
                style={{ color: "rgba(255,255,255,0.68)" }}
              >
                Keep your business records clear, organized and
                accessible from one place.
              </p>
            </div>
          </div>

          {/* Bottom statement */}
          <div className="relative z-10 hidden px-10 pb-10 lg:block xl:px-12 xl:pb-12">
            <div
              className="h-px w-10"
              style={{
                backgroundColor: "rgba(255,255,255,0.45)",
              }}
            />

            <p
              className="mt-4 max-w-[300px] text-[11px] leading-5"
              style={{ color: "rgba(255,255,255,0.52)" }}
            >
              Sales. Expenses. Employees. Reports.
              <br />
              One ledger for your business.
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Sign in panel                                                      */}
        {/* ---------------------------------------------------------------- */}

        <section
          className="relative flex w-full flex-1 items-center justify-center lg:w-[55%] lg:flex-none"
          style={{
            backgroundColor: colors.background,
          }}
        >
          <div
            className="bl-login-fade w-full max-w-[390px] px-5 py-7 sm:px-8 sm:py-8 lg:px-10"
            style={{
              animationDelay: "0.05s",
            }}
          >
            {/* Mobile label */}
            <div className="mb-6 lg:hidden">
              <div
                className="mb-2 h-px w-7"
                style={{
                  backgroundColor: colors.accent,
                }}
              />

              <p
                className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{
                  color: colors.secondary,
                }}
              >
                Sign in
              </p>
            </div>

            {/* Heading */}
            <div className="text-center">
              <h2
                className="text-[22px] font-semibold tracking-tight sm:text-[24px]"
                style={{
                  color: colors.text,
                }}
              >
                Welcome back
              </h2>

              <p
                className="mt-2 text-[12px] leading-5"
                style={{
                  color: colors.secondary,
                }}
              >
                Sign in to continue to your ledger.
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="mt-7 space-y-4"
              noValidate
            >
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-[11px] font-medium"
                  style={{
                    color: colors.text,
                  }}
                >
                  Email address
                </label>

                <div
                  className="flex h-11 items-center gap-3 rounded-md border px-3.5"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{
                      color: colors.secondary,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    <path
                      d="M3 6.5L12 13L21 6.5M4.5 19H19.5C20.3284 19 21 18.3284 21 17.5V6.5C21 5.67157 20.3284 5 19.5 5H4.5C3.67157 5 3 5.67157 3 6.5V17.5C3 18.3284 3.67157 19 4.5 19Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoFocus
                    placeholder="you@example.com"
                    required
                    className="h-full w-full bg-transparent text-[13px] outline-none placeholder:opacity-35"
                    style={{
                      color: colors.text,
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-[11px] font-medium"
                  style={{
                    color: colors.text,
                  }}
                >
                  Password
                </label>

                <div
                  className="flex h-11 items-center gap-3 rounded-md border px-3.5"
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{
                      color: colors.secondary,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    <rect
                      x="5"
                      y="10.5"
                      width="14"
                      height="9.5"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />

                    <path
                      d="M8 10.5V7.5C8 5.29086 9.79086 3.5 12 3.5C14.2091 3.5 16 5.29086 16 7.5V10.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                    className="h-full w-full bg-transparent text-[13px] outline-none placeholder:opacity-35"
                    style={{
                      color: colors.text,
                    }}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    className="shrink-0 text-[11px] font-medium transition-opacity hover:opacity-70"
                    style={{
                      color: colors.secondary,
                    }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
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
                className="mt-2 h-11 w-full rounded-md text-[12px] font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: colors.text,
                  color: colors.background,
                }}
              >
                {isLoading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            {/* Signup */}
            <div className="mt-7 text-center">
              <span
                className="text-[11px]"
                style={{
                  color: colors.muted,
                }}
              >
                Don't have an account?{" "}
              </span>

              <a
                href="/signup"
                className="text-[11px] font-medium transition-opacity hover:opacity-70"
                style={{
                  color: colors.text,
                }}
              >
                Create one
              </a>
            </div>

            {/* Footer */}
            <p
              className="mt-7 text-center text-[10px]"
              style={{
                color: colors.muted,
              }}
            >
              Blacklane Ledger
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}