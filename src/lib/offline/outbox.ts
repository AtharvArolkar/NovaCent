import { createOfflineStore } from "./storage";
import type { OutboxEnqueueInput, SyncOutboxItem, SyncOutboxStatus } from "./types";

const outboxStore = createOfflineStore<SyncOutboxItem>("syncOutbox");

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const enqueueOutboxItem = async <TPayload>(
  input: OutboxEnqueueInput<TPayload>,
) => {
  const now = new Date().toISOString();
  const item: SyncOutboxItem<TPayload> = {
    id: createId(),
    accountId: input.accountId,
    clientMutationId: input.clientMutationId ?? createId(),
    mutationType: input.mutationType,
    endpoint: input.endpoint,
    method: input.method ?? "POST",
    payload: input.payload,
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };

  await outboxStore.set(item);
  return item;
};

export const listOutboxItems = async (
  accountId?: string,
  statuses?: SyncOutboxStatus[],
) => {
  const items = await outboxStore.getAll();
  return items
    .filter((item) => !accountId || item.accountId === accountId)
    .filter((item) => !statuses || statuses.includes(item.status))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
};

export const markOutboxItem = async (
  id: string,
  update: Partial<
    Pick<
      SyncOutboxItem,
      "status" | "lastError" | "serverVersion" | "lastAttemptAt"
    >
  > & { incrementAttempts?: boolean },
) => {
  const item = await outboxStore.get(id);
  if (!item) return undefined;

  const updated: SyncOutboxItem = {
    ...item,
    ...update,
    attempts: item.attempts + (update.incrementAttempts ? 1 : 0),
    updatedAt: new Date().toISOString(),
  };
  delete (updated as { incrementAttempts?: boolean }).incrementAttempts;

  await outboxStore.set(updated);
  return updated;
};

export const removeOutboxItem = (id: string) => outboxStore.delete(id);

export const clearSyncedOutboxItems = async () => {
  const items = await outboxStore.getAll();
  await Promise.all(
    items
      .filter((item) => item.status === "synced")
      .map((item) => outboxStore.delete(item.id)),
  );
};

export const getPendingOutboxCount = async (accountId?: string) =>
  (await listOutboxItems(accountId, ["pending", "failed", "conflict"])).length;

