
import { LedgerSdk } from "@blacklane-ledger/sdk";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export const sdk = new LedgerSdk({
  baseUrl: apiUrl,
  getAccessToken: () => {
    if (typeof window === "undefined") {
      return null;
    }

    return localStorage.getItem("access_token");
  },
});

