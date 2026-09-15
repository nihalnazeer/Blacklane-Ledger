
import { ApiClient } from "./client";
import type {
  Business,
  BusinessCreate,
} from "./types";

export class BusinessesApi {
  constructor(private readonly client: ApiClient) {}

  mine(): Promise<Business[]> {
    return this.client.get<Business[]>(
      "/api/v1/businesses/mine",
    );
  }

  create(data: BusinessCreate): Promise<Business> {
    return this.client.post<Business>(
      "/api/v1/businesses",
      data,
    );
  }
}

