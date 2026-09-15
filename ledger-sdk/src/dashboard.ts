import { ApiClient } from "./client";
import type { Dashboard } from "./types";

export class DashboardApi {
  constructor(private readonly client: ApiClient) {}

  get(businessId: string): Promise<Dashboard> {
    return this.client.get<Dashboard>(
      `/api/v1/businesses/${businessId}/dashboard`,
    );
  }
}