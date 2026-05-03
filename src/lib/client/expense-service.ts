import { buildBudgetVariance, buildCategoryBreakdown } from "@/lib/reporting";
import type { ReportingChartData } from "@/lib/reporting";
import { classifyMoneyFlowType, investmentAmountForSignedAmount, isInvestmentCategoryName, spendImpactForSignedAmount, type MoneyFlowType } from "@/lib/spend-impact";
import { withApiActivity } from "@/lib/client/api-activity";
import { enqueueOutboxItem, listOutboxItems, markOutboxItem, removeOutboxItem } from "@/lib/offline";
import type { Account, Budget, Expense, ImportRow, Party } from "./demo-data";
import { accounts, budgets, expenses, imports, parties } from "./demo-data";

type Money = { amount?: number; currency?: string };
type LiveAccount = { id?: string; name?: string; baseCurrency?: string; currency?: string; isDefault?: boolean };
type LiveExpense = {
  id?: string;
  spentAt?: string;
  merchant?: string;
  description?: string;
  categoryName?: string;
  original?: Money;
  base?: Money;
  syncStatus?: string;
  source?: string;
  tripId?: string;
  partyId?: string;
  paidByParticipantId?: string;
  settlementId?: string;
  moneyFlowType?: MoneyFlowType;
  excludeFromLedger?: boolean;
};
type LiveBudgetIncludedExpense = {
  id?: string;
  date?: string;
  merchant?: string;
  categoryName?: string;
  amount?: number;
  currency?: string;
  source?: string;
};
type LiveBudget = {
  id?: string;
  scope?: "overall" | "category";
  categoryName?: string;
  limit?: Money;
  spent?: Money;
  period?: "monthly" | "yearly";
  alertThreshold?: number;
  includedExpenses?: LiveBudgetIncludedExpense[];
};
type LiveOverview = {
  totalSpend?: number;
  remainingBudget?: number;
  monthlyRemainingBudget?: number;
  yearlyRemainingBudget?: number;
  pendingImports?: number;
  totalInvested?: number;
  budgets?: LiveBudget[];
  expenses?: LiveExpense[];
};
type LiveParty = {
  id?: string;
  accountId?: string;
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
  description?: string;
  reference?: string;
  spentAt?: string;
  direction?: "withdrawal" | "deposit";
  original?: Money;
  amount?: number;
  withdrawalAmount?: Money;
  depositAmount?: Money;
  confidence?: number;
  suggestedCategoryName?: string;
  suggestedCategory?: string;
  status?: string;
  possibleDuplicates?: unknown[];
  moneyFlowType?: MoneyFlowType;
};
type LiveNotification = {
  id?: string;
  title?: string;
  body?: string;
  tone?: "info" | "warning" | "success";
  read?: boolean;
  createdAt?: string;
};
type LiveRecurringExpenseRule = {
  id?: string;
  merchant?: string;
  description?: string;
  categoryName?: string;
  original?: Money;
  frequency?: "daily" | "weekly" | "monthly" | "yearly";
  interval?: number;
  startsAt?: string;
  endsAt?: string;
  nextRunAt?: string;
  lastRunAt?: string;
  status?: "active" | "paused" | "ended";
  notes?: string;
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
export type ExpenseClassificationUpdateInput = {
  categoryName: string;
  moneyFlowType: MoneyFlowType;
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
  email?: string;
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
  accountId?: string;
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
export type RecurringExpenseRule = {
  id: string;
  merchant: string;
  description?: string;
  categoryName: string;
  amount: number;
  currency: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  startsAt: string;
  endsAt?: string;
  nextRunAt: string;
  lastRunAt?: string;
  status: "active" | "paused" | "ended";
  notes?: string;
};
export type OverviewData = {
  totalSpend: number;
  remainingBudget: number;
  monthlyRemainingBudget: number;
  yearlyRemainingBudget: number;
  pendingImports: number;
  totalInvested: number;
  budgets: Budget[];
  expenses: Expense[];
};
export type RecurringExpenseInput = {
  merchant: string;
  description?: string;
  categoryName: string;
  amount: number;
  currency: string;
  frequency: RecurringExpenseRule["frequency"];
  interval: number;
  startsAt: string;
  endsAt?: string;
  notes?: string;
};
export type SupportRequestInput = {
  name: string;
  type: "add_feature" | "report_issue" | "praise";
  comments: string;
};
export type ReportRangeInput = {
  startDate?: string;
  endDate?: string;
};
export type UserProfileDetails = {
  id: string;
  name: string;
  email?: string;
  image?: string;
  provider: string;
  defaultAccountId?: string;
  defaultAccountName?: string;
  createdAt?: string;
  updatedAt?: string;
  canChangePassword: boolean;
};
export type ProfileUpdateInput = {
  name: string;
};
export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type { MoneyFlowType };

const wait = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const asAmount = (money: Money | number | undefined) => {
  if (typeof money === "number") return money;
  return money?.amount ?? 0;
};

const displayCurrencyFor = (currency?: string) => currency?.toUpperCase() || "INR";

const clientRateCache = new Map<string, number>();

async function clientCurrencyRate(fromCurrency: string | undefined, toCurrency: string | undefined) {
  const from = displayCurrencyFor(fromCurrency);
  const to = displayCurrencyFor(toCurrency);
  if (from === to) return 1;

  const key = `${from}:${to}`;
  const cached = clientRateCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const params = new URLSearchParams({ from, to, amount: "1" });
    const payload = await requestJson<{ rate?: { rate?: number }; convertedAmount?: number }>(`/api/currency/rate?${params.toString()}`);
    const rate = Number(payload.rate?.rate ?? payload.convertedAmount);
    if (Number.isFinite(rate) && rate > 0) {
      clientRateCache.set(key, rate);
      return rate;
    }
  } catch {
    // Keep summaries usable offline or when rates are unavailable.
  }

  return 1;
}

async function convertClientAmount(amount: number, fromCurrency: string | undefined, toCurrency: string | undefined) {
  const rate = await clientCurrencyRate(fromCurrency, toCurrency);
  return Math.round(amount * rate * 100) / 100;
}

const expenseCalculationMoney = (expense: Pick<Expense, "amount" | "currency" | "baseAmount" | "baseCurrency">) => ({
  amount: expense.baseAmount ?? expense.amount,
  currency: expense.baseCurrency ?? expense.currency
});

type ClientSpendExpense = Pick<Expense, "amount" | "currency" | "baseAmount" | "baseCurrency" | "source" | "merchant" | "description" | "category" | "moneyFlowType">;

const spendImpactAmount = async (expense: ClientSpendExpense, targetCurrency = "INR") => {
  const calculationMoney = expenseCalculationMoney(expense);
  const amount = await convertClientAmount(calculationMoney.amount, calculationMoney.currency, targetCurrency);
  return spendImpactForSignedAmount(amount, expense);
};

const totalSpendImpact = async (expenseRows: ClientSpendExpense[], targetCurrency = "INR") => {
  const impacts = await Promise.all(expenseRows.map((expense) => spendImpactAmount(expense, targetCurrency)));
  return Math.max(0, Math.round(impacts.reduce((sum, amount) => sum + amount, 0) * 100) / 100);
};

const investmentImpactAmount = async (expense: ClientSpendExpense, targetCurrency = "INR") => {
  const calculationMoney = expenseCalculationMoney(expense);
  const amount = await convertClientAmount(calculationMoney.amount, calculationMoney.currency, targetCurrency);
  return investmentAmountForSignedAmount(amount, expense);
};

const totalInvestmentImpact = async (expenseRows: ClientSpendExpense[], targetCurrency = "INR") => {
  const impacts = await Promise.all(expenseRows.map((expense) => investmentImpactAmount(expense, targetCurrency)));
  return Math.max(0, Math.round(impacts.reduce((sum, amount) => sum + amount, 0) * 100) / 100);
};

async function totalRemainingBudget(budgetRows: Array<Pick<Budget, "limit" | "spent" | "currency">>, targetCurrency = "INR") {
  const converted = await Promise.all(
    budgetRows.map(async (budget) => {
      const remaining = Math.max(budget.limit - budget.spent, 0);
      return convertClientAmount(remaining, budget.currency, targetCurrency);
    })
  );
  return Math.round(converted.reduce((sum, amount) => sum + amount, 0) * 100) / 100;
}

async function convertBudgetForDisplay(budget: Budget, targetCurrency = "INR") {
  const sourceCurrency = budget.currency ?? "INR";
  const target = displayCurrencyFor(targetCurrency);
  const includedExpenses = budget.includedExpenses
    ? await Promise.all(
        budget.includedExpenses.map(async (expense) => ({
          ...expense,
          amount: await convertClientAmount(expense.amount, expense.currency ?? sourceCurrency, target),
          currency: target
        }))
      )
    : undefined;

  return {
    ...budget,
    limit: await convertClientAmount(budget.limit, sourceCurrency, target),
    spent: await convertClientAmount(budget.spent, sourceCurrency, target),
    currency: target,
    includedExpenses
  };
}

async function convertBudgetsForDisplay(budgetRows: Budget[], targetCurrency = "INR") {
  return Promise.all(budgetRows.map((budget) => convertBudgetForDisplay(budget, targetCurrency)));
}

const normalizeAccountName = (name?: string) => {
  const resolvedName = name?.trim() || "Account";
  return resolvedName === "Primary INR Account" ? "Primary Account" : resolvedName;
};

const withAccountQuery = (path: string, accountId?: string) => {
  if (!accountId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}accountId=${encodeURIComponent(accountId)}`;
};

async function requestJson<T>(path: string, accountId?: string, init?: RequestInit, activity?: { message?: string }): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const track = !(method === "GET" && path.startsWith("/api/notifications"));
  return withApiActivity(async () => {
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
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `Request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }, { track, message: activity?.message });
}

async function withFallback<T>(live: () => Promise<T>, mock: () => Promise<T>) {
  if (useMocks) return mock();
  return live();
}

const toAccount = (account: LiveAccount): Account => ({
  id: account.id ?? crypto.randomUUID(),
  name: normalizeAccountName(account.name),
  currency: account.baseCurrency ?? account.currency ?? "INR",
  type: "personal"
});

const toExpense = (expense: LiveExpense): Expense => {
  const original = expense.original ?? expense.base;
  const base = expense.base ?? expense.original;

  return {
    id: expense.id ?? crypto.randomUUID(),
    date: (expense.spentAt ?? new Date().toISOString()).slice(0, 10),
    merchant: expense.merchant ?? "Unknown merchant",
    description: expense.description,
    category: expense.categoryName ?? "Uncategorized",
    amount: asAmount(original),
    currency: original?.currency ?? "INR",
    baseAmount: base ? asAmount(base) : undefined,
    baseCurrency: base?.currency,
    owner: expense.source ?? "Account",
    status: expense.syncStatus === "pending" ? "pending" : expense.syncStatus === "failed" || expense.syncStatus === "conflict" ? "needs-review" : "cleared",
    source: expense.source,
    moneyFlowType: expense.moneyFlowType,
    tripId: expense.tripId,
    partyId: expense.partyId,
    settlementId: expense.settlementId,
    canDelete: expense.source !== "settlement" && !expense.settlementId
  };
};

const toBudget = (budget: LiveBudget): Budget => ({
  id: budget.id ?? crypto.randomUUID(),
  category: budget.categoryName ?? "Uncategorized",
  limit: asAmount(budget.limit),
  spent: asAmount(budget.spent),
  scope: budget.scope ?? "category",
  currency: budget.limit?.currency ?? budget.spent?.currency ?? "INR",
  period: budget.period ?? "monthly",
  alertThreshold: budget.alertThreshold ?? 80,
  includedExpenses: budget.includedExpenses?.map((expense) => ({
    id: expense.id ?? crypto.randomUUID(),
    date: expense.date ?? new Date().toISOString().slice(0, 10),
    merchant: expense.merchant ?? "Unknown merchant",
    category: expense.categoryName ?? "Uncategorized",
    amount: expense.amount ?? 0,
    currency: expense.currency,
    source: expense.source
  }))
});

const toParty = (party: LiveParty): Party => ({
  id: party.id ?? crypto.randomUUID(),
  name: party.name ?? "Party",
  balance: asAmount(party.balance),
  balanceCurrency: typeof party.balance === "number" ? undefined : party.balance?.currency,
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
  accountId: payload.party.accountId,
  name: payload.party.name ?? "Party",
  canManage: payload.canManage ?? true,
  participants: payload.party.participants?.map(toPartyParticipant) ?? [],
  expenses: payload.expenses?.map(toExpense) ?? [],
  splits: payload.splits?.map(toPartySplit) ?? [],
  settlements: payload.settlements?.map(toPartySettlement) ?? []
});

const toImportRow = (row: LiveImportRow, batch: LiveImportBatch): ImportRow => {
  const amount = asAmount(row.original ?? row.amount);
  const withdrawalAmount = asAmount(row.withdrawalAmount) || (amount > 0 ? amount : 0);
  const depositAmount = asAmount(row.depositAmount) || (amount < 0 ? Math.abs(amount) : 0);

  return {
    id: row.id ?? crypto.randomUUID(),
    batchId: row.batchId ?? batch.id,
    source: batch.fileName ?? batch.id ?? row.batchId ?? "Import",
    date: row.spentAt?.slice(0, 10),
    reference: row.reference,
    merchant: row.description ?? row.merchant ?? "Unknown merchant",
    amount,
    currency: row.original?.currency ?? row.withdrawalAmount?.currency ?? row.depositAmount?.currency ?? "INR",
    direction: row.direction,
    moneyFlowType: row.moneyFlowType,
    withdrawalAmount,
    depositAmount,
    confidence: row.confidence ?? 0,
    suggestedCategory: row.suggestedCategoryName ?? row.suggestedCategory ?? "Uncategorized",
    isPossibleDuplicate: row.status === "possible_duplicate" || Boolean(row.possibleDuplicates?.length)
  };
};

const toRecurringRule = (rule: LiveRecurringExpenseRule): RecurringExpenseRule => ({
  id: rule.id ?? crypto.randomUUID(),
  merchant: rule.merchant ?? "Recurring expense",
  description: rule.description,
  categoryName: rule.categoryName ?? "Uncategorized",
  amount: asAmount(rule.original),
  currency: rule.original?.currency ?? "INR",
  frequency: rule.frequency ?? "monthly",
  interval: rule.interval ?? 1,
  startsAt: (rule.startsAt ?? new Date().toISOString()).slice(0, 10),
  endsAt: rule.endsAt?.slice(0, 10),
  nextRunAt: (rule.nextRunAt ?? new Date().toISOString()).slice(0, 10),
  lastRunAt: rule.lastRunAt?.slice(0, 10),
  status: rule.status ?? "active",
  notes: rule.notes
});

const categoryIdFor = (categoryName: string) =>
  `cat-${categoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "uncategorized"}`;

const recurringPayload = (input: RecurringExpenseInput) => ({
  merchant: input.merchant,
  description: input.description,
  categoryId: categoryIdFor(input.categoryName),
  categoryName: input.categoryName,
  original: { amount: input.amount, currency: input.currency },
  frequency: input.frequency,
  interval: input.interval,
  startsAt: input.startsAt,
  endsAt: input.endsAt || undefined,
  nextRunAt: input.startsAt,
  autoCreate: true,
  notes: input.notes
});

const toPendingExpense = (input: ExpenseCreateInput, clientMutationId: string): Expense => ({
  id: clientMutationId,
  date: input.spentAt.slice(0, 10),
  merchant: input.merchant,
  category: input.categoryName,
  amount: input.amount,
  currency: input.currency,
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
  alertThreshold: input.alertThreshold,
  includedExpenses: []
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

export async function getOverview(accountId?: string, targetCurrency = "INR") {
  return withFallback(
    async () => {
      const params = new URLSearchParams({ targetCurrency: displayCurrencyFor(targetCurrency) });
      const payload = await requestJson<LiveOverview>(`/api/overview?${params.toString()}`, accountId);
      const budgetRows = await convertBudgetsForDisplay((payload.budgets ?? []).map(toBudget), targetCurrency);
      return {
        totalSpend: Number(payload.totalSpend ?? 0),
        remainingBudget: Number(payload.remainingBudget ?? 0),
        monthlyRemainingBudget: Number(payload.monthlyRemainingBudget ?? 0),
        yearlyRemainingBudget: Number(payload.yearlyRemainingBudget ?? 0),
        pendingImports: Number(payload.pendingImports ?? 0),
        totalInvested: Number(payload.totalInvested ?? 0),
        budgets: budgetRows,
        expenses: (payload.expenses ?? []).map(toExpense)
      };
    },
    async () => {
      await wait();
      const monthlyBudgets = budgets.filter((budget) => (budget.period ?? "monthly") === "monthly");
      const yearlyBudgets = budgets.filter((budget) => budget.period === "yearly");
      const currentYear = new Date().getFullYear();
      const yearExpenses = expenses.filter((expense) => new Date(expense.date).getFullYear() === currentYear);
      const [totalSpend, totalInvested, remainingBudget, monthlyRemainingBudget, yearlyRemainingBudget] = await Promise.all([
        totalSpendImpact(expenses, targetCurrency),
        totalInvestmentImpact(yearExpenses, targetCurrency),
        totalRemainingBudget(budgets, targetCurrency),
        totalRemainingBudget(monthlyBudgets, targetCurrency),
        totalRemainingBudget(yearlyBudgets, targetCurrency)
      ]);
      return {
        totalSpend,
        remainingBudget,
        monthlyRemainingBudget,
        yearlyRemainingBudget,
        pendingImports: imports.length,
        totalInvested,
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

type InvestmentRange = "1m" | "3m" | "1y" | "3y" | "all";

function investmentRangeStart(range: InvestmentRange) {
  if (range === "all") return undefined;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (range === "1m") start.setUTCMonth(start.getUTCMonth() - 1);
  if (range === "3m") start.setUTCMonth(start.getUTCMonth() - 3);
  if (range === "1y") start.setUTCFullYear(start.getUTCFullYear() - 1);
  if (range === "3y") start.setUTCFullYear(start.getUTCFullYear() - 3);
  return start.toISOString().slice(0, 10);
}

function exclusiveEndDate(date?: string) {
  if (!date) return undefined;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function isInvestmentExpense(expense: Expense) {
  return expense.moneyFlowType === "investment" || isInvestmentCategoryName(expense.category);
}

export async function getInvestments(accountId?: string, range: InvestmentRange = "1y", dateRange: ReportRangeInput = {}) {
  const from = dateRange.startDate || investmentRangeStart(range);
  const to = exclusiveEndDate(dateRange.endDate);
  return withFallback(
    async () => {
      const params = new URLSearchParams({ moneyFlowType: "investment", limit: "5000" });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const payload = await requestJson<{ expenses: LiveExpense[] }>(`/api/expenses?${params.toString()}`, accountId);
      return payload.expenses.map(toExpense);
    },
    async () => {
      await wait();
      const start = from ? new Date(from).getTime() : undefined;
      const end = to ? new Date(to).getTime() : undefined;
      return expenses.filter((expense) => {
        if (!isInvestmentExpense(expense)) return false;
        const spentAt = new Date(expense.date).getTime();
        if (start && spentAt < start) return false;
        if (end && spentAt >= end) return false;
        return true;
      });
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

export async function updateExpenseClassification(accountId: string, expenseId: string, input: ExpenseClassificationUpdateInput) {
  if (useMocks) {
    await wait();
    const existing = expenses.find((expense) => expense.id === expenseId);
    return existing
      ? { ...existing, category: input.categoryName, moneyFlowType: input.moneyFlowType }
      : undefined;
  }

  const result = await requestJson<{ expense: LiveExpense }>(`/api/expenses/${expenseId}`, accountId, {
    method: "PATCH",
    body: JSON.stringify({
      categoryId: categoryIdFor(input.categoryName),
      categoryName: input.categoryName,
      moneyFlowType: input.moneyFlowType
    })
  });
  return toExpense(result.expense);
}

export async function deleteExpense(accountId: string, expenseId: string) {
  if (useMocks) {
    await wait();
    return { deleted: true };
  }

  return requestJson<{ deleted: boolean }>(`/api/expenses/${expenseId}`, accountId, { method: "DELETE" });
}

export async function deleteExpenses(accountId: string, expenseIds: string[]) {
  const uniqueExpenseIds = Array.from(new Set(expenseIds.filter(Boolean)));
  if (!uniqueExpenseIds.length) {
    return { deletedIds: [], skippedIds: [], deletedCount: 0, skippedCount: 0 };
  }

  if (useMocks) {
    await wait();
    return {
      deletedIds: uniqueExpenseIds,
      skippedIds: [],
      deletedCount: uniqueExpenseIds.length,
      skippedCount: 0
    };
  }

  return requestJson<{
    requestedCount: number;
    deletedCount: number;
    skippedCount: number;
    deletedIds: string[];
    skippedIds: string[];
  }>("/api/expenses/bulk-delete", accountId, {
    method: "POST",
    body: JSON.stringify({ expenseIds: uniqueExpenseIds })
  });
}

export async function syncPendingOutbox(accountId?: string) {
  if (useMocks || typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const items = await listOutboxItems(accountId, ["pending", "failed"]);
  if (!items.length) {
    return { synced: 0, failed: 0 };
  }

  return withApiActivity(async () => {
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
  }, { message: "Syncing changes..." });
}

export async function getBudgets(accountId?: string, targetCurrency = "INR") {
  return withFallback(
    async () => {
      const payload = await requestJson<{ budgets: LiveBudget[] }>("/api/budgets", accountId);
      return convertBudgetsForDisplay(payload.budgets.map(toBudget), targetCurrency);
    },
    async () => {
      await wait();
      return convertBudgetsForDisplay(budgets, targetCurrency);
    }
  );
}

export async function createBudget(accountId: string, input: BudgetCreateInput, targetCurrency = input.currency) {
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
      return convertBudgetForDisplay(toBudget(result.budget), targetCurrency);
    },
    async () => {
      await wait();
      return convertBudgetForDisplay(toLocalBudget(input), targetCurrency);
    }
  );
}

export async function updateBudget(accountId: string, budgetId: string, input: BudgetCreateInput, targetCurrency = input.currency) {
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
      return convertBudgetForDisplay(toBudget(result.budget), targetCurrency);
    },
    async () => {
      await wait();
      return convertBudgetForDisplay({ ...toLocalBudget(input), id: budgetId }, targetCurrency);
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

export async function getRecurringExpenses(accountId?: string) {
  return withFallback(
    async () => {
      const payload = await requestJson<{ recurringExpenses: LiveRecurringExpenseRule[] }>("/api/recurring-expenses", accountId);
      return payload.recurringExpenses.map(toRecurringRule);
    },
    async () => {
      await wait();
      return [] as RecurringExpenseRule[];
    }
  );
}

export async function createRecurringExpenseRule(accountId: string, input: RecurringExpenseInput) {
  return withFallback(
    async () => {
      const payload = await requestJson<{ recurringExpense: LiveRecurringExpenseRule }>("/api/recurring-expenses", accountId, {
        method: "POST",
        body: JSON.stringify(recurringPayload(input))
      });
      return toRecurringRule(payload.recurringExpense);
    },
    async () => {
      await wait();
      return {
        id: crypto.randomUUID(),
        merchant: input.merchant,
        description: input.description,
        categoryName: input.categoryName,
        amount: input.amount,
        currency: input.currency,
        frequency: input.frequency,
        interval: input.interval,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        nextRunAt: input.startsAt,
        status: "active" as const,
        notes: input.notes
      };
    }
  );
}

export async function updateRecurringExpenseRule(accountId: string, ruleId: string, input: Partial<RecurringExpenseInput> & { status?: RecurringExpenseRule["status"] }) {
  return withFallback(
    async () => {
      const body = {
        ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.categoryName !== undefined ? { categoryId: categoryIdFor(input.categoryName), categoryName: input.categoryName } : {}),
        ...(input.amount !== undefined || input.currency !== undefined ? { original: { amount: input.amount ?? 0, currency: input.currency ?? "INR" } } : {}),
        ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
        ...(input.interval !== undefined ? { interval: input.interval } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt, nextRunAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt || undefined } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        autoCreate: true
      };
      const payload = await requestJson<{ recurringExpense: LiveRecurringExpenseRule }>(`/api/recurring-expenses/${ruleId}`, accountId, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      return toRecurringRule(payload.recurringExpense);
    },
    async () => {
      await wait();
      return {
        id: ruleId,
        merchant: input.merchant ?? "Recurring expense",
        description: input.description,
        categoryName: input.categoryName ?? "Uncategorized",
        amount: input.amount ?? 0,
        currency: input.currency ?? "INR",
        frequency: input.frequency ?? "monthly",
        interval: input.interval ?? 1,
        startsAt: input.startsAt ?? new Date().toISOString().slice(0, 10),
        endsAt: input.endsAt,
        nextRunAt: input.startsAt ?? new Date().toISOString().slice(0, 10),
        status: input.status ?? "active",
        notes: input.notes
      } as RecurringExpenseRule;
    }
  );
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
      if (!input.splits.length) {
        return { expense, splits: [] };
      }
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

export async function addExistingExpensesToParty(accountId: string, partyId: string, expenseIds: string[]) {
  if (useMocks) {
    await wait();
    return { convertedExpenseIds: expenseIds, splits: [] as PartySplit[] };
  }

  const payload = await requestJson<{ convertedExpenseIds: string[]; splits: LiveSplit[] }>(`/api/parties/${partyId}/expenses/from-existing`, accountId, {
    method: "POST",
    body: JSON.stringify({ expenseIds })
  });

  return {
    convertedExpenseIds: payload.convertedExpenseIds,
    splits: payload.splits.map(toPartySplit)
  };
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

export async function uploadStatement(accountId: string, file: File, statementPassword?: string) {
  if (useMocks) {
    return imports;
  }

  const formData = new FormData();
  formData.append("file", file);
  if (statementPassword?.trim()) {
    formData.append("statementPassword", statementPassword.trim());
  }
  return withApiActivity(async () => {
    const response = await fetch(withAccountQuery("/api/imports", accountId), {
      method: "POST",
      headers: { "x-account-id": accountId },
      body: formData
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `Import upload failed: ${response.status}`);
    }

    const payload = (await response.json()) as { batch: LiveImportBatch };
    return (payload.batch.rows ?? []).map((row) => toImportRow(row, payload.batch));
  }, { message: "Processing statement..." });
}

type ImportReviewResponse = {
  approvedExpenses?: unknown[];
  approvedCount?: number;
  approved?: number;
  deletedRows?: number;
  deletedCount?: number;
  deleted?: number;
  skippedCount?: number;
};

function importReviewCounts(response: ImportReviewResponse, action: "approve" | "delete") {
  const approved = response.approvedCount ?? response.approved ?? response.approvedExpenses?.length ?? 0;
  const deleted = response.deletedCount ?? response.deleted ?? response.deletedRows ?? 0;
  return {
    approved: action === "approve" ? approved : 0,
    deleted: action === "delete" ? deleted : 0
  };
}

function importReviewMoneyFlowType(row: ImportRow, categoryName?: string, moneyFlowType?: MoneyFlowType) {
  if (moneyFlowType) return moneyFlowType;
  const resolvedCategoryName = categoryName?.trim() || row.suggestedCategory || "Uncategorized";
  if (isInvestmentCategoryName(resolvedCategoryName)) return "investment";
  if (resolvedCategoryName === "Loan/EMI") return "spend";
  return classifyMoneyFlowType(row.amount, {
    source: "import",
    merchant: row.merchant,
    categoryName: resolvedCategoryName,
    moneyFlowType: row.moneyFlowType
  });
}

function importReviewPayload(row: ImportRow, action: "approve" | "delete", categoryName?: string, moneyFlowType?: MoneyFlowType) {
  const resolvedCategoryName = categoryName?.trim() || row.suggestedCategory || "Uncategorized";
  const resolvedMoneyFlowType = importReviewMoneyFlowType(row, resolvedCategoryName, moneyFlowType);
  return {
    ...(row.batchId ? { batchId: row.batchId } : {}),
    rowId: row.id,
    action,
    ...(action === "approve" ? { categoryId: categoryIdFor(resolvedCategoryName), categoryName: resolvedCategoryName, moneyFlowType: resolvedMoneyFlowType } : {}),
    confirmDuplicate: row.isPossibleDuplicate && action === "approve",
    overrideReason: row.isPossibleDuplicate && action === "approve" ? "Confirmed during import review" : undefined
  };
}

export async function reviewImportRow(accountId: string, row: ImportRow, action: "approve" | "delete", options: { categoryName?: string; moneyFlowType?: MoneyFlowType } = {}) {
  if (useMocks || !row.batchId) {
    return { approved: action === "approve" ? 1 : 0, deleted: action === "delete" ? 1 : 0 };
  }

  const response = await requestJson<ImportReviewResponse>(`/api/imports/${row.batchId}/approve`, accountId, {
    method: "POST",
    body: JSON.stringify({
      rows: [importReviewPayload(row, action, options.categoryName, options.moneyFlowType)]
    })
  }, { message: action === "approve" ? "Saving imported rows..." : "Updating imported rows..." });

  return importReviewCounts(response, action);
}

export async function reviewImportRows(accountId: string, rows: Array<{ row: ImportRow; categoryName?: string; moneyFlowType?: MoneyFlowType }>, action: "approve" | "delete") {
  if (!rows.length) return { approved: 0, deleted: 0 };

  if (useMocks) {
    return { approved: action === "approve" ? rows.length : 0, deleted: action === "delete" ? rows.length : 0 };
  }

  const rowsWithoutBatch = rows.filter(({ row }) => !row.batchId).length;
  const rowsWithBatch = rows.filter(({ row }) => row.batchId);

  let approved = action === "approve" ? rowsWithoutBatch : 0;
  let deleted = action === "delete" ? rowsWithoutBatch : 0;

  if (rowsWithBatch.length) {
    const response = await requestJson<ImportReviewResponse>("/api/imports/review", accountId, {
      method: "POST",
      body: JSON.stringify({
        rows: rowsWithBatch.map(({ row, categoryName, moneyFlowType }) => importReviewPayload(row, action, categoryName, moneyFlowType))
      })
    }, { message: action === "approve" ? "Saving imported rows..." : "Updating imported rows..." });
    const counts = importReviewCounts(response, action);
    approved += counts.approved;
    deleted += counts.deleted;
  }

  return { approved, deleted };
}

const fallbackReportData = (): ReportingChartData => ({
  totalSpent: budgets.reduce((sum, budget) => sum + budget.spent, 0),
  categories: buildCategoryBreakdown(budgets),
  cashflow: [
    { label: "Jan", income: 182000, spend: 121400 },
    { label: "Feb", income: 182000, spend: 116900 },
    { label: "Mar", income: 194000, spend: 132600 },
    { label: "Apr", income: 194000, spend: 144686 },
    { label: "May", income: 202000, spend: 127430 },
    { label: "Jun", income: 202000, spend: 139200 }
  ],
  investments: [
    { label: "Jan", value: 12000 },
    { label: "Feb", value: 15000 },
    { label: "Mar", value: 10000 },
    { label: "Apr", value: 18000 },
    { label: "May", value: 14000 },
    { label: "Jun", value: 16000 }
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

async function convertLabeledRows(rows: ReportingChartData["categories"], sourceCurrency: string, targetCurrency: string) {
  return Promise.all(rows.map(async (row) => ({ ...row, value: await convertClientAmount(row.value, sourceCurrency, targetCurrency) })));
}

async function convertReportData(data: ReportingChartData, sourceCurrency: string, targetCurrency: string): Promise<ReportingChartData> {
  return {
    totalSpent: data.totalSpent === undefined ? undefined : await convertClientAmount(data.totalSpent, sourceCurrency, targetCurrency),
    categories: await convertLabeledRows(data.categories, sourceCurrency, targetCurrency),
    cashflow: await Promise.all(
      data.cashflow.map(async (row) => ({
        ...row,
        income: await convertClientAmount(row.income, sourceCurrency, targetCurrency),
        spend: await convertClientAmount(row.spend, sourceCurrency, targetCurrency)
      }))
    ),
    investments: await convertLabeledRows(data.investments, sourceCurrency, targetCurrency),
    budgetVariance: await Promise.all(
      data.budgetVariance.map(async (row) => ({
        ...row,
        budget: await convertClientAmount(row.budget, sourceCurrency, targetCurrency),
        actual: await convertClientAmount(row.actual, sourceCurrency, targetCurrency),
        remaining: await convertClientAmount(row.remaining, sourceCurrency, targetCurrency)
      }))
    ),
    merchantTrends: await Promise.all(
      data.merchantTrends.map(async (row) => ({
        ...row,
        food: await convertClientAmount(row.food, sourceCurrency, targetCurrency),
        travel: await convertClientAmount(row.travel, sourceCurrency, targetCurrency),
        shopping: await convertClientAmount(row.shopping, sourceCurrency, targetCurrency),
        subscriptions: await convertClientAmount(row.subscriptions, sourceCurrency, targetCurrency)
      }))
    ),
    trips: await convertLabeledRows(data.trips, sourceCurrency, targetCurrency),
    parties: await Promise.all(
      data.parties.map(async (row) => ({
        ...row,
        outstanding: await convertClientAmount(row.outstanding, sourceCurrency, targetCurrency),
        settled: await convertClientAmount(row.settled, sourceCurrency, targetCurrency)
      }))
    ),
    currencies: await Promise.all(
      data.currencies.map(async (row) => ({ ...row, value: await convertClientAmount(row.value, row.label, targetCurrency) }))
    )
  };
}

export async function getReports(accountId?: string, range: ReportRangeInput = {}, targetCurrency = "INR"): Promise<ReportingChartData> {
  return withFallback(
    async () => {
      const params = new URLSearchParams();
      if (range.startDate) params.set("startDate", range.startDate);
      if (range.endDate) params.set("endDate", range.endDate);
      const path = params.size ? `/api/reports/summary?${params.toString()}` : "/api/reports/summary";
      const payload = await requestJson<{
        report: {
          categoryBreakdown?: Array<{ category: string; amount: number }>;
          monthlyTrend?: Array<{ month: string; amount: number; income?: number; spend?: number }>;
          investmentTrend?: Array<{ month: string; amount: number }>;
          budgetVariance?: Array<{ categoryName: string; limitAmount: number; actualAmount: number; remainingAmount: number; usagePercent: number }>;
          merchantTrends?: Array<{ month: string; food: number; travel: number; shopping: number; subscriptions: number }>;
          partyBalances?: Array<{ party: string; outstanding: number; settled: number }>;
          currencyExposure?: Array<{ currency: string; amount: number }>;
          totalSpent?: { amount: number; currency: string };
        };
      }>(path, accountId);
      const reportCurrency = payload.report.totalSpent?.currency ?? "INR";
      const categoryRows = payload.report.categoryBreakdown?.map((row) => ({ label: row.category, value: row.amount })) ?? [];
      const reportData = {
        totalSpent: payload.report.totalSpent?.amount ?? categoryRows.reduce((sum, row) => sum + row.value, 0),
        categories: categoryRows,
        cashflow: payload.report.monthlyTrend?.map((row) => ({
          label: row.month,
          income: row.income ?? (row.amount < 0 ? Math.abs(row.amount) : 0),
          spend: row.spend ?? (row.amount > 0 ? row.amount : 0)
        })) ?? [],
        investments: payload.report.investmentTrend?.map((row) => ({ label: row.month, value: row.amount })) ?? [],
        budgetVariance: payload.report.budgetVariance?.map((row) => ({
          label: row.categoryName,
          budget: row.limitAmount,
          actual: row.actualAmount,
          remaining: row.remainingAmount,
          usage: row.usagePercent
        })) ?? [],
        merchantTrends: payload.report.merchantTrends?.map((row) => ({
          label: row.month,
          food: row.food,
          travel: row.travel,
          shopping: row.shopping,
          subscriptions: row.subscriptions
        })) ?? [],
        trips: [],
        parties: payload.report.partyBalances?.map((row) => ({ label: row.party, outstanding: row.outstanding, settled: row.settled })) ?? [],
        currencies: payload.report.currencyExposure?.map((row) => ({ label: row.currency, value: row.amount })) ?? []
      };
      return convertReportData(reportData, reportCurrency, targetCurrency);
    },
    async () => {
      await wait();
      return convertReportData(fallbackReportData(), "INR", targetCurrency);
    }
  );
}

export function reportDataToCsv(data: ReportingChartData) {
  const rows = [
    ["section", "label", "value_a", "value_b", "value_c"],
    ...data.categories.map((row) => ["category", row.label, row.value, "", ""]),
    ...data.cashflow.map((row) => ["cashflow", row.label, row.income, row.spend, row.income - row.spend]),
    ...data.investments.map((row) => ["investment", row.label, row.value, "", ""]),
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

export async function submitSupportRequest(accountId: string, input: SupportRequestInput) {
  if (useMocks) {
    await wait();
    return {
      id: crypto.randomUUID(),
      ...input,
      status: "open"
    };
  }

  return requestJson<{ supportRequest: unknown }>("/api/support", accountId, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function getProfile() {
  if (useMocks) {
    await wait();
    return {
      id: "demo-user",
      name: "Atharv Arolkar",
      email: "atharv@example.com",
      provider: "credentials",
      defaultAccountName: "Primary Account",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      canChangePassword: true
    } satisfies UserProfileDetails;
  }

  const payload = await requestJson<{ profile: UserProfileDetails }>("/api/profile");
  return payload.profile;
}

export async function updateProfile(input: ProfileUpdateInput) {
  if (useMocks) {
    await wait();
    return {
      id: "demo-user",
      name: input.name,
      email: "atharv@example.com",
      provider: "credentials",
      defaultAccountName: "Primary Account",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      canChangePassword: true
    } satisfies UserProfileDetails;
  }

  const payload = await requestJson<{ profile: UserProfileDetails }>("/api/profile", undefined, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
  return payload.profile;
}

export async function changePassword(input: ChangePasswordInput) {
  return requestJson<{ message: string }>("/api/auth/change-password", undefined, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function markNotificationsRead(accountId?: string) {
  if (useMocks) return;

  try {
    await withApiActivity(() => fetch(withAccountQuery("/api/notifications", accountId), {
      method: "PATCH",
      headers: accountId ? { "x-account-id": accountId } : undefined
    }).then(() => undefined), { message: "Updating notifications..." });
  } catch {
    // Notification read state is nice-to-have; keep the shell usable offline.
  }
}

export async function clearNotifications(accountId?: string) {
  if (useMocks) return;

  await requestJson<{ cleared: boolean; deletedCount: number }>("/api/notifications", accountId, {
    method: "DELETE"
  });
}
