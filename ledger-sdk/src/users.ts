
import { ApiClient } from "./client";
import type {
  User,
  UserCreate,
} from "./types";

export class UsersApi {
  constructor(private readonly client: ApiClient) {}

  list(): Promise<User[]> {
    return this.client.get<User[]>(
      "/api/v1/users",
    );
  }

  create(data: UserCreate): Promise<User> {
    return this.client.post<User>(
      "/api/v1/users",
      data,
    );
  }
}

