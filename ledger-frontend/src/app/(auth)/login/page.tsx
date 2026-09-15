"use client";

import { useState, type FormEvent } from "react";
import { sdk } from "@/lib/api";

/**
 * Brand palette — same source/approximations as Sales, Expenses, and
 * Employees. Border, accent, and error aren't given exact hex on the
 * brand sheet; keep all four files in sync if you land exact values.
 */
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
      const tokens = await sdk.auth.login({ email, password });

      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);

      window.location.href = "/businesses";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main
      className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-5 py-10"
      style={{
        backgroundColor: colors.background,
        paddingTop: "max(2.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* Local animation + texture styles — scoped to this page */}
      <style>{`
        @keyframes bl-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bl-glow-pulse {
          0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); }
          50%      { opacity: 0.85; transform: translate(-50%, -50%) scale(1.08); }
        }
        .bl-fade-up {
          animation: bl-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>

      {/* Faint ledger-grid texture across the whole page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(${colors.border} 1px, transparent 1px),
            linear-gradient(90deg, ${colors.border} 1px, transparent 1px)
          `,
          backgroundSize: "34px 34px",
          opacity: 0.35,
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 40%, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 40%, transparent 85%)",
        }}
      />

      {/* Soft pulsing glow behind the logo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[15%] h-[280px] w-[280px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.accent} 0%, transparent 70%)`,
          filter: "blur(60px)",
          animation: "bl-glow-pulse 5s ease-in-out infinite",
        }}
      />

      <div className="relative w-full max-w-[380px]">
        {/* Logo */}
        <div className="bl-fade-up mb-9 flex flex-col items-center">
          <div
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-xl font-extrabold lowercase shadow-lg"
            style={{ backgroundColor: colors.text, color: colors.background }}
          >
            b<span style={{ color: colors.accent }}>.</span>
          </div>

          <div
            className="flex items-baseline text-[26px] font-extrabold lowercase tracking-tight"
            style={{ color: colors.text }}
          >
            blacklane
            <span style={{ color: colors.accent }}>.</span>
          </div>
          <p
            className="mt-0.5 text-[12px] font-medium lowercase tracking-[0.2em]"
            style={{ color: colors.secondary }}
          >
            ledger
          </p>

          <p className="mt-3 text-[13px] italic" style={{ color: colors.muted }}>
            Clarity in every transaction.
          </p>
        </div>

        {/* Form card */}
        <div
          className="bl-fade-up rounded-2xl p-6 shadow-2xl"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            animationDelay: "0.1s",
          }}
        >
          <h1 className="text-center text-[19px] font-semibold" style={{ color: colors.text }}>
            Sign in
          </h1>
          <p className="mt-1.5 text-center text-[13px]" style={{ color: colors.secondary }}>
            Enter your details to access your ledger.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-[13px] font-medium"
                style={{ color: colors.text }}
              >
                Email address
              </label>

              <div
                className="flex h-12 items-center gap-3 rounded-md border px-4"
                style={{ backgroundColor: colors.background, borderColor: colors.border }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ color: colors.secondary, flexShrink: 0 }}
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
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoFocus
                  placeholder="Enter your email address"
                  required
                  className="h-full w-full bg-transparent text-base outline-none"
                  style={{ color: colors.text }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[13px] font-medium"
                style={{ color: colors.text }}
              >
                Password
              </label>

              <div
                className="flex h-12 items-center gap-3 rounded-md border px-4"
                style={{ backgroundColor: colors.background, borderColor: colors.border }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ color: colors.secondary, flexShrink: 0 }}
                  aria-hidden="true"
                >
                  <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
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
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  className="h-full w-full bg-transparent text-base outline-none"
                  style={{ color: colors.text }}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="shrink-0 text-[12px] font-medium transition-opacity hover:opacity-70"
                  style={{ color: colors.secondary }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="pt-1 text-center">
              <a href="/forgot-password" className="text-[13px]" style={{ color: colors.secondary }}>
                Forgot password?
              </a>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="rounded-md px-4 py-2.5 text-[13px]"
                style={{ backgroundColor: colors.errorBackground, color: colors.error }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 h-12 w-full rounded-md text-[14px] font-semibold transition-opacity duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: colors.accent, color: colors.text }}
            >
              {isLoading ? "Signing in\u2026" : "Sign in"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="bl-fade-up mt-8 text-center text-[12px]" style={{ color: colors.muted, animationDelay: "0.2s" }}>
          Powered by blacklane
        </p>
      </div>
    </main>
  );
}