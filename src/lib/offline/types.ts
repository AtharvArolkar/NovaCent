export type OfflineRecordStatus = "fresh" | "stale" | "expired";

export type SyncOutboxStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "failed"
  | "conflict";

export type SyncMutationType =
  | "expense.create"
  | "expense.update"
  | "expense.delete"
  | "importRow.approve"
  | "importRow.delete"
  | "settlement.create"
  | "settlement.approve"
  | string;

export interface CachedReport<TPayload = unknown> {
  id: string;
  accountId: string;
  reportType: string;
  cacheKey: string;
  payload: TPayload;
  generatedAt: string;
  expiresAt?: string;
  version?: string;
}

export interface CachedCurrencyRate {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  provider: string;
  fetchedAt: string;
  effectiveDate?: string;
  expiresAt?: string;
}

export interface SyncOutboxItem<TPayload = unknown> {
  id: string;
  accountId: string;
  clientMutationId: string;
  mutationType: SyncMutationType;
  endpoint?: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  payload: TPayload;
  status: SyncOutboxStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt?: string;
  lastError?: string;
  serverVersion?: string;
}

export interface OutboxEnqueueInput<TPayload = unknown> {
  accountId: string;
  mutationType: SyncMutationType;
  payload: TPayload;
  endpoint?: string;
  method?: SyncOutboxItem["method"];
  clientMutationId?: string;
}

export interface OfflineStore<TRecord extends { id: string }> {
  get(id: string): Promise<TRecord | undefined>;
  getAll(): Promise<TRecord[]>;
  set(record: TRecord): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

