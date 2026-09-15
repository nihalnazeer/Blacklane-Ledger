import { ApiClient } from "./client";
import type { Sale, SaleCreate, SaleUpdate } from "./types";

export class SalesApi {
constructor(private readonly client: ApiClient) {}

list(businessId: string): Promise<Sale[]> {
return this.client.get<Sale[]>(
`/api/v1/businesses/${businessId}/sales`,
);
}

get(businessId: string, saleId: string): Promise<Sale> {
return this.client.get<Sale>(
`/api/v1/businesses/${businessId}/sales/${saleId}`,
);
}

create(businessId: string, data: SaleCreate): Promise<Sale> {
return this.client.post<Sale>(
`/api/v1/businesses/${businessId}/sales`,
data,
);
}

update(
businessId: string,
saleId: string,
data: SaleUpdate,
): Promise<Sale> {
return this.client.patch<Sale>(
`/api/v1/businesses/${businessId}/sales/${saleId}`,
data,
);
}

delete(businessId: string, saleId: string): Promise<void> {
return this.client.delete<void>(
`/api/v1/businesses/${businessId}/sales/${saleId}`,
);
}
}
