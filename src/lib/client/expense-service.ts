import { buildBudgetVariance, buildCategoryBreakdown } from "@/lib/reporting";
import type { ReportingChartData } from "@/lib/reporting";
import { enqueueOutboxItem, listOutboxItems, markOutboxItem, removeOutboxItem } from "@/lib/offline";
import type { Account, Budget, Expense, ImportRow, Party } from "./demo-data";
import { accounts, budgets, expenses, imports, parties } from "./demo-data";

type Money = { amount?: number; currency?: string };
type LiveAccount = { id?: string; name?: string; baseCurrency?: string; currency?: string; isDefault?: boolean };
type LiveExpense = {
  id?: string;
  spentAt?: string;
  merchant?: string;
  categoryName?: string;
  original?: Money;
  base?: Money;
  syncStatus?: string;
  source?: string;
  tripId?: string;
  partyId?: string;
  paidByParticipantId?: string;
  settlementId?: string;
  excludeFromLedger?: boolean;
};
type LiveBudget = { id?: string; scope?: "overall" | "category"; categoryName?: string; limit?: Money; spent?: Money; period?: "monthly" | "yearly"; alertThreshold?: number };
type LiveParty = {
  id?: string;
  name?: string;
  participants?: LivePartyParticipant[];
  balance?: Money | number;
};
type LivePartyParticipant = {
  id?: string;
  kind?: "registered" | "external";
  displayName?: string;
  userId?: string;
  accountId?: string;
  email?: string;
};
type LiveSplit = {
  id?: string;
  expenseId?: string;
  paidByParticipantId?: string;
  participantId?: string;
  amount?: Money;
  status?: "open" | "settlement_pending" | "settled";
};
type LiveSettlement = {
  id?: string;
  splitId?: string;
  participantId?: string;
  approvalParticipantId?: string;
  amount?: Money;
  status?: "pending_approval" | "settled" | "rejected";
  requiresApproval?: boolean;
  requestedAt?: string;
  approvedAt?: string;
};
type LiveUserSearchResult = {
  id?: string;
  name?: string;
  email?: string;
  image?: string;
  defaultAccountId?: string;
};
type LiveImportBatch = { id?: string; fileName?: string; rows?: LiveImportRow[] };
type LiveImportRow = {
  id?: string;
  batchId?: string;
  merchant?: string;
  original?: Money;
  amount?: number;
  confidence?: number;
  suggestedCategoryName?: string;
  suggestedCategory?: string;
  status?: string;
  possibleDuplicates?: unknown[];
};
type LiveNotification = {
  id?: string;
  title?: string;
  body?: string;
  tone?: "info" | "warning" | "success";
  read?: boolean;
  createdAt?: string;
};
export type Notification = {
  id: string;
  title: string;
  body: string;
  tone: "info" | "warning" | "success";
  read: boolean;
  createdAt: string;
};
export type ExpenseCreateInput = {
  merchant: string;
  categoryName: string;
  amount: number;
  currency: string;
  spentAt: string;
  source?: "manual" | "recurring" | "import" | "trip" | "party";
  tripId?: string;
  partyId?: string;
  paidByParticipantId?: string;
  excludeFromLedger?: boolean;
};
export type BudgetCreateInput = {
  categoryName: string;
  scope: "overall" | "category";
  limit: number;
  currency: string;
  period: "monthly" | "yearly";
  alertThreshold: number;
};
export type PartyCreateInput = {
  name: string;
  participantNames?: string[];
  participants?: PartyParticipantInput[];
};
export type PartyParticipantInput = {
  kind: "registered" | "external";
  displayName: string;
  userId?: string;
  accountId?: string;
};
export type UserSearchResult = {
  id: string;
  name: string;
  email: string;
  image?: string;
  defaultAccountId?: string;
};
export type PartyParticipant = {
  id: string;
  kind: "registered" | "external";
  displayName: string;
  userId?: string;
  accountId?: string;
  email?: string;
};
export type PartySplit = {
  id: string;
  expenseId: string;
  paidByParticipantId?: string;
  participantId: string;
  amount: number;
  currency: string;
  status: "open" | "settlement_pending" | "settled";
};
export type PartySettlement = {
  id: string;
  splitId: string;
  participantId: string;
  approvalParticipantId?: string;
  amount: number;
  currency: string;
  status: "pending_approval" | "settled" | "rejected";
  requiresApproval: boolean;
  requestedAt: string;
};
export type PartyDetail = {
  id: string;
  name: string;
  canManage: boolean;
  participants: PartyParticipant[];
  expenses: Expense[];
  splits: PartySplit[];
  settlements: PartySettlement[];
};
export type PartyExpenseCreateInput = {
  merchant: string;
  categoryName: string;
  amount: number;
  currency: string;
  spentAt: string;
  paidByParticipantId: string;
  excludeFromLedger?: boolean;
  splits: Array<{ participantId: string; amount: number }>;
};

const wait = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const asAmount = (money: Money | number | undefined) => {
  if (typeof money === "number") return money;
  return money?.amount ?? 0;
};

const withAccountQuery = (path: string, accountId?: string) => {
  if (!accountId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}accountId=${encodeURIComponent(accountId)}`;
};

async function requestJson<T>(path: string, accountId?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(withAccountQuery(path, accountId), {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(accountId ? { "x-account-id": accountId } : {}),
      ...init?.headers
    },
    cache: init?.cache ?? "no-store"
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function withFallback<T>(live: () => Promise<T>, mock: () => Promise<T>) {
  if (useMocks) return mock();
  return live();
}

const toAccount = (account: LiveAccount): Account => ({
  id: account.id ?? crypto.randomUUID(),
  name: account.name ?? "Account",
  currency: account.baseCurrency ?? account.currency ?? "INR",
  type: "personal"
});

const toExpense = (expense: LiveExpense): Expense => ({
  id: expense.id ?? crypto.randomUUID(),
  date: (expense.spentAt ?? new Date().toISOString()).slice(0, 10),
  merchant: expense.merchant ?? "Unknown merchant",
  category: expense.categoryName ?? "Uncategorized",
  amount: asAmount(expense.base ?? expense.original),
  owner: expense.source ?? "Account",
  status: expense.syncStatus === "pending" ? "pending" : expense.syncStatus === "failed" || expense.syncStatus === "conflict" ? "needs-review" : "cleared",
  source: expense.source,
  tripId: expense.tripId,
  partyId: expense.partyId,
  settlementId: expense.settlementId,
  canDelete: expense.source !== "settlement" && !expense.settlementId
});

const toBudget = (budget: LiveBudget): Budget => ({
  id: budget.id ?? crypto.randomUUID(),
  category: budget.categoryName ?? "Uncategorized",
  limit: asAmount(budget.limit),
  spent: asAmount(budget.spent),
  scope: budget.scope ?? "category",
  currency: budget.limit?.currency ?? budget.spent?.currency ?? "INR",
  period: budget.period ?? "monthly",
  alertThreshold: budget.alertThreshold ?? 80
});

const toParty = (party: LiveParty): Party => ({
  id: party.id ?? crypto.randomUUID(),
  name: party.name ?? "Party",
  balance: asAmount(party.balance),
  members: party.participants?.map((participant) => participant.displayName ?? "Participant") ?? []
});

const toPartyParticipant = (participant: LivePartyParticipant): PartyParticipant => ({
  id: participant.id ?? crypto.randomUUID(),
  kind: participant.kind ?? "external",
  displayName: participant.displayName ?? "Participant",
  userId: participant.userId,
  accountId: participant.accountId,
  email: participant.email
});

const toPartySplit = (split: LiveSplit): PartySplit => ({
  id: split.id ?? crypto.randomUUID(),
  expenseId: split.expenseId ?? "",
  paidByParticipantId: split.paidByParticipantId,
  participantId: split.participantId ?? "",
  amount: asAmount(split.amount),
  currency: split.amount?.currency ?? "INR",
  status: split.status ?? "open"
});

const toPartySettlement = (settlement: LiveSettlement): PartySettlement => ({
  id: settlement.id ?? crypto.randomUUID(),
  splitId: settlement.splitId ?? "",
  participantId: settlement.participantId ?? "",
  approvalParticipantId: settlement.approvalParticipantId,
  amount: asAmount(settlement.amount),
  currency: settlement.amount?.currency ?? "INR",
  status: settlement.status ?? "pending_approval",
  requiresApproval: settlement.requiresApproval ?? false,
  requestedAt: settlement.requestedAt ?? new Date().toISOString()
});

const toPartyDetail = (payload: { party: LiveParty; expenses?: LiveExpense[]; splits?: LiveSplit[]; settlements?: LiveSettlement[]; canManage?: boolean }): PartyDetail => ({
  id: payload.party.id ?? crypto.randomUUID(),
  name: payload.party.name ?? "Party",
  canManage: payload.canManage ?? true,
  participants: payload.party.participants?.map(toPartyParticipant) ?? [],
  expenses: payload.expenses?.map(toExpense) ?? [],
  splits: payload.splits?.map(toPartySplit) ?? [],
  settlements: payload.settlements?.map(toPartySettlement) ?? []
});

const toImportRow = (row: LiveImportRow, batch: LiveImportBatch): ImportRow => ({
  id: row.id ?? crypto.randomUUID(),
  batchId: row.batchId ?? batch.id,
  source: batch.fileName ?? batch.id ?? row.batchId ?? "Import",
  merchant: row.merchant ?? "Unknown merchant",
  amount: asAmount(row.original ?? row.amount),
  confidence: row.confidence ?? 0,
  suggestedCategory: row.suggestedCategoryName ?? row.suggestedCategory ?? "Uncategorized",
  isPossibleDuplicate: row.status === "possible_duplicate" || Boolean(row.possibleDuplicates?.length)
});

const categoryIdFor = (categoryName: string) =>
  `cat-${categoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "uncategorized"}`;

const toPendingExpense = (input: ExpenseCreateInput, clientMutationId: string): Expense => ({
  id: clientMutationId,
  date: input.spentAt.slice(0, 10),
  merchant: input.merchant,
  category: input.categoryName,
  amount: input.amount,
  owner: "Pending sync",
  status: "pending"
});

const toLocalBudget = (input: BudgetCreateInput): Budget => ({
  id: crypto.randomUUID(),
  category: input.categoryName,
  limit: input.limit,
  spent: 0,
  scope: input.scope,
  currency: input.currency,
  period: input.period,
  alertThreshold: input.alertThreshold
});

const toLocalParty = (input: PartyCreateInput): Party => ({
  id: crypto.randomUUID(),
  name: input.name,
  balance: 0,
  members: participantsForPartyInput(input).map((participant) => participant.displayName)
});

const participantsForPartyInput = (input: PartyCreateInput): PartyParticipantInput[] => {
  if (input.participants?.length) return input.participants;
  return (input.participantNames ?? []).map((displayName) => ({ kind: "external" as const, displayName }));
};

export async function getAccounts() {
  return withFallback(
    async () => {
      const payload = await requestJson<{ accounts: LiveAccount[] }>("/api/accounts");
      const liveAccounts = payload.accounts.map(toAccount);
      return liveAccounts;
    },
    async () => {
      await wait();
      return accounts;
    }
  );
}

export async function getOverview(accountId?: string) {
  return withFallback(
    async () => {
      const [expenseRows, budgetRows, importRows] = await Promise.all([getExpenses(accountId), getBudgets(accountId), getImportRows(accountId)]);
      const totalSpend = expenseRows.reduce((sum, expense) => sum + expense.amount, 0);
      const remainingBudget = budgetRows.reduce((sum, budget) => sum + Math.max(budget.limit - budget.spent, 0), 0);
      return {
        totalSpend,
        remainingBudget,
        monthlyRunway: 18,
        pendingImports: importRows.length,
        budgets: budgetRows,
        expenses: expenseRows.slice(0, 5)
      };
    },
    async () => {
      await wait();
      const totalSpend = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const remainingBudget = budgets.reduce((sum, budget) => sum + Math.max(budget.limit - budget.spent, 0), 0);
      return {
        totalSpend,
        remainingBudget,
        monthlyRunway: 18,
        pendingImports: imports.length,
        budgets,
        expenses: expenses.slice(0, 5)
      };
    }
  );
}

export async function getExpenses(accountId?: string) {
  return withFallback(
    async () => {
      const payload = await requestJson<{ expenses: LiveExpense[] }>("/api/expenses", accountId);
      return payload.expenses.map(toExpense);
    },
    async () => {
      await wait();
      return expenses;
    }
  );
}

export async function createExpense(accountId: string, input: ExpenseCreateInput) {
  const clientMutationId = crypto.randomUUID();
  const payload = {
    merchant: input.merchant,
    categoryId: categoryIdFor(input.categoryName),
    categoryName: input.categoryName,
    original: {
      amount: input.amount,
      currency: input.currency
    },
    spentAt: input.spentAt,
    source: input.source ?? "manual",
    tripId: input.tripId,
    partyId: input.partyId,
    paidByParticipantId: input.paidByParticipantId,
    excludeFromLedger: input.excludeFromLedger,
    clientMutationId
  };

  if (useMocks || typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueOutboxItem({
      accountId,
      clientMutationId,
      mutationType: "expense.create",
      endpoint: "/api/expenses",
      method: "POST",
      payload
    });
    return toPendingExpense(input, clientMutationId);
  }

  try {
    const result = await requestJson<{ expense: LiveExpense }>("/api/expenses", accountId, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    return toExpense(result.expense);
  } catch (error) {
    await enqueueOutboxItem({
      accountId,
      clientMutationId,
      mutationType: "expense.create",
      endpoint: "/api/expenses",
      method: "POST",
      payload
    });
    return toPendingExpense(input, clientMutationId);
  }
}

export async function deleteExpense(accountId: string, expenseId: string) {
  if (useMocks) {
    await wait();
    return { deleted: true };
  }

  return requestJson<{ deleted: boolean }>(`/api/expenses/${expenseId}`, accountId, { method: "DELETE" });
}

export async function syncPendingOutbox(accountId?: string) {
  if (useMocks || typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const items = await listOutboxItems(accountId, ["pending", "failed"]);
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (!item.endpoint || !item.method) {
      continue;
    }

    await markOutboxItem(item.id, { status: "syncing", lastAttemptAt: new Date().toISOString(), incrementAttempts: true });

    try {
      const response = await fetch(withAccountQuery(item.endpoint, item.accountId), {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          "x-account-id": item.accountId
        },
        body: JSON.stringify({ ...(item.payload as Record<string, unknown>), clientMutationId: item.clientMutationId })
      });

      if (!response.ok) {
        throw new Error(`Sync failed with ${response.status}`);
      }

      await markOutboxItem(item.id, { status: "synced", lastAttemptAt: new Date().toISOString() });
      await removeOutboxItem(item.id);
      synced += 1;
    } catch (error) {
      await markOutboxItem(item.id, {
        status: "failed",
        lastAttemptAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : "Sync failed"
      });
      failed += 1;
    }
  }

  return { synced, failed };
}

export async function getBudgets(accountId?: string) {
  return withFallback(
    async () => {
      const payload = await requestJson<{ budgets: LiveBudget[] }>("/api/budgets", accountId);
      return payload.budgets.map(toBudget);
    },
    async () => {
      await wait();
      return budgets;
    }
  );
}

export async function createBudget(accountId: string, input: BudgetCreateInput) {
  return withFallback(
    async () => {
      const payload = {
        scope: input.scope,
        categoryId: categoryIdFor(input.categoryName),
        categoryName: input.categoryName,
        period: input.period,
        limit: { amount: input.limit, currency: input.currency },
        alertThreshold: input.alertThreshold
      };
      const result = await requestJson<{ budget: LiveBudget }>("/api/budgets", accountId, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      return toBudget(result.budget);
    },
    async () => {
      await wait();
      return toLocalBudget(input);
    }
  );
}

export async function updateBudget(accountId: string, budgetId: string, input: BudgetCreateInput) {
  return withFallback(
    async () => {
      const payload = {
        scope: input.scope,
        categoryId: categoryIdFor(input.categoryName),
        categoryName: input.categoryName,
        period: input.period,
        limit: { amount: input.limit, currency: input.currency },
        alertThreshold: input.alertThreshold
      };
      const result = await requestJson<{ budget: LiveBudget }>(`/api/budgets/${budgetId}`, accountId, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      return toBudget(result.budget);
    },
    async () => {
      await wait();
      return { ...toLocalBudget(input), id: budgetId };
    }
  );
}

export async function deleteBudget(accountId: string, budgetId: string) {
  if (useMocks) {
    await wait();
    return { deleted: true };
  }

  return requestJson<{ deleted: boolean }>(`/api/budgets/${budgetId}`, accountId, { method: "DELETE" });
}

export async function getParties(accountId?: string) {
  return withFallback(
    async () => {
      const payload = await requestJson<{ parties: LiveParty[] }>("/api/parties", accountId);
      return payload.parties.map(toParty);
    },
    async () => {
      await wait();
      return parties;
    }
  );
}

export async function createParty(accountId: string, input: PartyCreateInput) {
  return withFallback(
    async () => {
      const result = await requestJson<{ party: LiveParty }>("/api/parties", accountId, {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          participants: participantsForPartyInput(input)
        })
      });
      return toParty(result.party);
    },
    async () => {
      await wait();
      return toLocalParty(input);
    }
  );
}

export async function deleteParty(accountId: string, partyId: string) {
  if (useMocks) {
    await wait();
    return { deleted: true };
  }

  return requestJson<{ deleted: boolean; deletedExpenses: number }>(`/api/parties/${partyId}`, accountId, { method: "DELETE" });
}

export async function deletePartyExpense(accountId: string, partyId: string, expenseId: string) {
  if (useMocks) {
    await wait();
    return { deleted: true };
  }

  return requestJson<{ deleted: boolean }>(`/api/parties/${partyId}/expenses/${expenseId}`, accountId, { method: "DELETE" });
}

export async function searchUsers(query: string) {
  if (useMocks || query.trim().length < 2) {
    await wait();
    return [] as UserSearchResult[];
  }

  const payload = await requestJson<{ users: LiveUserSearchResult[] }>(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
  return payload.users.map((user) => ({
    id: user.id ?? crypto.randomUUID(),
    name: user.name ?? user.email ?? "User",
    email: user.email ?? "",
    image: user.image,
    defaultAccountId: user.defaultAccountId
  }));
}

export async function getPartyDetail(accountId: string, partyId: string) {
  return withFallback(
    async () => {
      const payload = await requestJson<{ party: LiveParty; expenses: LiveExpense[]; splits: LiveSplit[]; settlements: LiveSettlement[]; canManage?: boolean }>(`/api/parties/${partyId}`, accountId);
      return toPartyDetail(payload);
    },
    async () => {
      await wait();
      const party = parties.find((item) => item.id === partyId) ?? parties[0];
      return {
        id: party.id,
        name: party.name,
        canManage: true,
        participants: party.members.map((displayName) => ({
          id: crypto.randomUUID(),
          kind: "external" as const,
          displayName
        })),
        expenses: [],
        splits: [],
        settlements: []
      };
    }
  );
}

export async function addPartyParticipant(accountId: string, partyId: string, participant: PartyParticipantInput) {
  return withFallback(
    async () => {
      const payload = await requestJson<{ party: LiveParty }>(`/api/parties/${partyId}`, accountId, {
        method: "PATCH",
        body: JSON.stringify({ participant })
      });
      return payload.party.participants?.map(toPartyParticipant) ?? [];
    },
    async () => {
      await wait();
      return [{ id: crypto.randomUUID(), ...participant }];
    }
  );
}

export async function createPartyExpense(accountId: string, partyId: string, input: PartyExpenseCreateInput) {
  return withFallback(
    async () => {
      const expense = await createExpense(accountId, {
        merchant: input.merchant,
        categoryName: input.categoryName,
        amount: input.amount,
        currency: input.currency,
        spentAt: input.spentAt,
        source: "party",
        partyId,
        paidByParticipantId: input.paidByParticipantId,
        excludeFromLedger: input.excludeFromLedger
      });
      const splitPayload = await requestJson<{ splits: LiveSplit[] }>(`/api/parties/${partyId}/splits`, accountId, {
        method: "POST",
        body: JSON.stringify({
          expenseId: expense.id,
          paidByParticipantId: input.paidByParticipantId,
          splits: input.splits.map((split) => ({
            participantId: split.participantId,
            amount: { amount: split.amount, currency: input.currency }
          }))
        })
      });
      return { expense, splits: splitPayload.splits.map(toPartySplit) };
    },
    async () => {
      await wait();
      const expense = toPendingExpense(
        {
          merchant: input.merchant,
          categoryName: input.categoryName,
          amount: input.amount,
          currency: input.currency,
          spentAt: input.spentAt,
          source: "party",
          partyId,
          paidByParticipantId: input.paidByParticipantId,
          excludeFromLedger: input.excludeFromLedger
        },
        crypto.randomUUID()
      );
      return {
        expense,
        splits: input.splits.map((split) => ({
          id: crypto.randomUUID(),
          expenseId: expense.id,
          paidByParticipantId: input.paidByParticipantId,
          participantId: split.participantId,
          amount: split.amount,
          currency: input.currency,
          status: "open" as const
        }))
      };
    }
  );
}

export async function markPartySplitSettled(accountId: string, partyId: string, split: PartySplit, participantKind: "registered" | "external") {
  return withFallback(
    async () => {
      const payload = await requestJson<{ settlement: LiveSettlement }>(`/api/parties/${partyId}/settlements`, accountId, {
        method: "POST",
        body: JSON.stringify({
          splitId: split.id,
          participantId: split.participantId,
          participantKind,
          amount: { amount: split.amount, currency: split.currency }
        })
      });
      return toPartySettlement(payload.settlement);
    },
    async () => {
      await wait();
      return {
        id: crypto.randomUUID(),
        splitId: split.id,
        participantId: split.participantId,
        amount: split.amount,
        currency: split.currency,
        status: participantKind === "external" ? "settled" as const : "pending_approval" as const,
        requiresApproval: participantKind === "registered",
        requestedAt: new Date().toISOString()
      };
    }
  );
}

export async function approvePartySettlement(accountId: string, partyId: string, settlementId: string, action: "approve" | "reject") {
  return withFallback(
    async () =>
      requestJson<{ settlementId: string; status: string }>(`/api/parties/${partyId}/settlements/${settlementId}/approve`, accountId, {
        method: "POST",
        body: JSON.stringify({ action })
      }),
    async () => {
      await wait();
      return { settlementId, status: action === "approve" ? "settled" : "rejected" };
    }
  );
}

export async function getImportRows(accountId?: string) {
  return withFallback(
    async () => {
      const payload = await requestJson<{ batches: LiveImportBatch[] }>("/api/imports", accountId);
      return payload.batches.flatMap((batch) => (batch.rows ?? []).filter((row) => row.status !== "approved" && row.status !== "deleted").map((row) => toImportRow(row, batch)));
    },
    async () => {
      await wait();
      return imports;
    }
  );
}

export async function uploadStatement(accountId: string, file: File) {
  if (useMocks) {
    return imports;
  }

  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(withAccountQuery("/api/imports", accountId), {
    method: "POST",
    headers: { "x-account-id": accountId },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Import upload failed: ${response.status}`);
  }

  const payload = (await response.json()) as { batch: LiveImportBatch };
  return (payload.batch.rows ?? []).map((row) => toImportRow(row, payload.batch));
}

export async function reviewImportRow(accountId: string, row: ImportRow, action: "approve" | "delete") {
  if (useMocks || !row.batchId) {
    return { approved: action === "approve" ? 1 : 0, deleted: action === "delete" ? 1 : 0 };
  }

  const response = await requestJson<{ approvedExpenses?: unknown[]; deletedRows?: number }>(`/api/imports/${row.batchId}/approve`, accountId, {
    method: "POST",
    body: JSON.stringify({
      rows: [
        {
          rowId: row.id,
          action,
          confirmDuplicate: row.isPossibleDuplicate && action === "approve",
          overrideReason: row.isPossibleDuplicate && action === "approve" ? "Confirmed during import review" : undefined
        }
      ]
    })
  });

  return {
    approved: response.approvedExpenses?.length ?? 0,
    deleted: response.deletedRows ?? 0
  };
}

const fallbackReportData = (): ReportingChartData => ({
  categories: buildCategoryBreakdown(budgets),
  cashflow: [
    { label: "Jan", income: 182000, spend: 121400 },
    { label: "Feb", income: 182000, spend: 116900 },
    { label: "Mar", income: 194000, spend: 132600 },
    { label: "Apr", income: 194000, spend: 144686 },
    { label: "May", income: 202000, spend: 127430 },
    { label: "Jun", income: 202000, spend: 139200 }
  ],
  budgetVariance: buildBudgetVariance(budgets),
  merchantTrends: [
    { label: "Jan", food: 9400, travel: 6800, shopping: 5200, subscriptions: 1649 },
    { label: "Feb", food: 10200, travel: 7200, shopping: 4100, subscriptions: 1649 },
    { label: "Mar", food: 11750, travel: 9800, shopping: 7600, subscriptions: 2297 },
    { label: "Apr", food: 12750, travel: 15340, shopping: 4299, subscriptions: 2297 },
    { label: "May", food: 8900, travel: 14200, shopping: 6800, subscriptions: 2297 },
    { label: "Jun", food: 10600, travel: 9800, shopping: 8100, subscriptions: 2297 }
  ],
  trips: [],
  parties: parties.map((party, index) => ({
    label: party.name,
    outstanding: Math.max(party.balance, 0),
    settled: index === 0 ? 2400 : 6400
  })),
  currencies: [
    { label: "INR", value: 59120 },
    { label: "AED", value: 1364 },
    { label: "USD", value: 2297 }
  ]
});

export async function getReports(accountId?: string): Promise<ReportingChartData> {
  return withFallback(
    async () => {
      const payload = await requestJson<{
        report: {
          categoryBreakdown?: Array<{ category: string; amount: number }>;
          monthlyTrend?: Array<{ month: string; amount: number }>;
        };
      }>("/api/reports/summary", accountId);
      return {
        categories: payload.report.categoryBreakdown?.map((row) => ({ label: row.category, value: row.amount })) ?? [],
        cashflow: payload.report.monthlyTrend?.map((row) => ({ label: row.month, income: 0, spend: row.amount })) ?? [],
        budgetVariance: [],
        merchantTrends: [],
        trips: [],
        parties: [],
        currencies: []
      };
    },
    async () => {
      await wait();
      return fallbackReportData();
    }
  );
}

export function reportDataToCsv(data: ReportingChartData) {
  const rows = [
    ["section", "label", "value_a", "value_b", "value_c"],
    ...data.categories.map((row) => ["category", row.label, row.value, "", ""]),
    ...data.cashflow.map((row) => ["cashflow", row.label, row.income, row.spend, row.income - row.spend]),
    ...data.budgetVariance.map((row) => ["budget", row.label, row.budget, row.actual, row.remaining]),
    ...data.parties.map((row) => ["party", row.label, row.outstanding, row.settled, ""]),
    ...data.currencies.map((row) => ["currency", row.label, row.value, "", ""])
  ];

  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export async function getNotifications(accountId?: string) {
  return withFallback(
    async () => {
      const payload = await requestJson<{ notifications: LiveNotification[] }>("/api/notifications", accountId);
      return payload.notifications.map<Notification>((notification) => ({
        id: notification.id ?? crypto.randomUUID(),
        title: notification.title ?? "Notification",
        body: notification.body ?? "",
        tone: notification.tone ?? "info",
        read: notification.read ?? false,
        createdAt: notification.createdAt ?? new Date().toISOString()
      }));
    },
    async () => {
      await wait();
      return [
        {
          id: "demo-notification-import",
          title: "Import review ready",
          body: "A statement import has rows waiting for approval.",
          tone: "warning" as const,
          read: false,
          createdAt: new Date().toISOString()
        }
      ];
    }
  );
}

export async function markNotificationsRead(accountId?: string) {
  if (useMocks) return;

  try {
    await fetch(withAccountQuery("/api/notifications", accountId), {
      method: "PATCH",
      headers: accountId ? { "x-account-id": accountId } : undefined
    });
  } catch {
    // Notification read state is nice-to-have; keep the shell usable offline.
  }
}
