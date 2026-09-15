
import { ApiClient } from "./client";
import type {
  CurrentUserResponse,
  LoginRequest,
  RefreshRequest,
  TokenResponse,
} from "./types";

export class AuthApi {
  constructor(private readonly client: ApiClient) {}

  login(credentials: LoginRequest): Promise<TokenResponse> {
    return this.client.post<TokenResponse>(
      "/api/v1/auth/login",
      credentials,
    );
  }

  refresh(refreshToken: string): Promise<TokenResponse> {
    const request: RefreshRequest = {
      refresh_token: refreshToken,
    };

    return this.client.post<TokenResponse>(
      "/api/v1/auth/refresh",
      request,
    );
  }

  me(): Promise<CurrentUserResponse> {
    return this.client.get<CurrentUserResponse>(
      "/api/v1/auth/me",
    );
  }
}

