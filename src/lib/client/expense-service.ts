import { buildBudgetVariance, buildCategoryBreakdown } from "@/lib/reporting";
import type { ReportingChartData } from "@/lib/reporting";
import { enqueueOutboxItem, listOutboxItems, markOutboxItem, removeOutboxItem } from "@/lib/offline";
import type { Account, Budget, Expense, ImportRow, Party, Trip } from "./demo-data";
import { accounts, budgets, expenses, imports, parties, trips } from "./demo-data";

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
};
type LiveBudget = { id?: string; categoryName?: string; limit?: Money; spent?: Money };
type LiveTrip = {
  id?: string;
  name?: string;
  destination?: string;
  startsAt?: string;
  endsAt?: string;
  participantCount?: number;
  budget?: Money;
  spend?: Money;
};
type LiveParty = {
  id?: string;
  name?: string;
  participants?: Array<{ displayName?: string }>;
  balance?: Money | number;
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

  try {
    return await live();
  } catch {
    return mock();
  }
}

const formatTripDates = (trip: LiveTrip) => {
  if (!trip.startsAt) return trip.destination ?? "Dates pending";
  const start = new Date(trip.startsAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  const end = trip.endsAt ? new Date(trip.endsAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "";
  return end ? `${start}-${end}` : start;
};

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
  status: expense.syncStatus === "pending" ? "pending" : expense.syncStatus === "failed" || expense.syncStatus === "conflict" ? "needs-review" : "cleared"
});

const toBudget = (budget: LiveBudget): Budget => ({
  id: budget.id ?? crypto.randomUUID(),
  category: budget.categoryName ?? "Uncategorized",
  limit: asAmount(budget.limit),
  spent: asAmount(budget.spent)
});

const toTrip = (trip: LiveTrip): Trip => ({
  id: trip.id ?? crypto.randomUUID(),
  name: trip.name ?? trip.destination ?? "Trip",
  dates: formatTripDates(trip),
  spend: asAmount(trip.spend),
  budget: asAmount(trip.budget) || 1,
  members: trip.participantCount ?? 1
});

const toParty = (party: LiveParty): Party => ({
  id: party.id ?? crypto.randomUUID(),
  name: party.name ?? "Party",
  balance: asAmount(party.balance),
  members: party.participants?.map((participant) => participant.displayName ?? "Participant") ?? []
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

export async function getAccounts() {
  return withFallback(
    async () => {
      const payload = await requestJson<{ accounts: LiveAccount[] }>("/api/accounts");
      const liveAccounts = payload.accounts.map(toAccount);
      return liveAccounts.length ? liveAccounts : accounts;
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
    source: "manual",
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

export async function getTripsAndParties(accountId?: string) {
  return withFallback(
    async () => {
      const [tripPayload, partyPayload] = await Promise.all([
        requestJson<{ trips: LiveTrip[] }>("/api/trips", accountId),
        requestJson<{ parties: LiveParty[] }>("/api/parties", accountId)
      ]);
      return { trips: tripPayload.trips.map(toTrip), parties: partyPayload.parties.map(toParty) };
    },
    async () => {
      await wait();
      return { trips, parties };
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
  trips: trips.map((trip) => ({ label: trip.name, value: trip.spend })),
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
      const fallback = fallbackReportData();
      return {
        categories: payload.report.categoryBreakdown?.map((row) => ({ label: row.category, value: row.amount })) ?? [],
        cashflow: payload.report.monthlyTrend?.map((row) => ({ label: row.month, income: 0, spend: row.amount })) ?? [],
        budgetVariance: fallback.budgetVariance,
        merchantTrends: fallback.merchantTrends,
        trips: fallback.trips,
        parties: fallback.parties,
        currencies: fallback.currencies
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
    ...data.trips.map((row) => ["trip", row.label, row.value, "", ""]),
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
