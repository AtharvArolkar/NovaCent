export type CurrencyCode = string;

export type AccountRole = "owner" | "viewer";

export type ParticipantKind = "registered" | "external";

export type SettlementStatus = "pending_approval" | "settled" | "rejected";

export type SyncStatus = "synced" | "pending" | "failed" | "conflict";

export type ImportRowStatus = "review" | "possible_duplicate" | "deleted" | "approved";

export type ExpenseSource = "manual" | "recurring" | "import" | "trip" | "party" | "settlement";

export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type RecurringExpenseStatus = "active" | "paused" | "ended";

export type BudgetPeriod = "monthly" | "yearly";

export type BudgetScope = "overall" | "category";

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export interface CurrencySnapshot {
  from: CurrencyCode;
  to: CurrencyCode;
  rate: number;
  provider: string;
  fetchedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  baseCurrency: CurrencyCode;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  accountId: string;
  name: string;
  color: string;
  icon: string;
  isSystem: boolean;
}

export interface CategoryRule {
  id: string;
  accountId: string;
  pattern: string;
  categoryId: string;
  categoryName: string;
}

export interface Expense {
  id: string;
  accountId: string;
  source: ExpenseSource;
  merchant: string;
  description?: string;
  categoryId: string;
  categoryName: string;
  original: Money;
  base: Money;
  exchangeRate?: CurrencySnapshot;
  spentAt: string;
  notes?: string;
  tripId?: string;
  partyId?: string;
  paidByParticipantId?: string;
  settlementId?: string;
  splitId?: string;
  excludeFromLedger?: boolean;
  recurringRuleId?: string;
  syncStatus: SyncStatus;
  clientMutationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringExpenseRule {
  id: string;
  accountId: string;
  merchant: string;
  description?: string;
  categoryId: string;
  categoryName: string;
  original: Money;
  frequency: RecurringFrequency;
  interval: number;
  startsAt: string;
  endsAt?: string;
  nextRunAt: string;
  lastRunAt?: string;
  status: RecurringExpenseStatus;
  autoCreate: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  accountId: string;
  scope?: BudgetScope;
  categoryId: string;
  categoryName: string;
  period: BudgetPeriod;
  limit: Money;
  alertThreshold: number;
  spent: Money;
}

export interface NotificationItem {
  id: string;
  accountId: string;
  title: string;
  body: string;
  tone: "info" | "warning" | "success";
  read: boolean;
  createdAt: string;
}

export interface Trip {
  id: string;
  accountId: string;
  name: string;
  destination: string;
  startsAt: string;
  endsAt?: string;
  baseCurrency: CurrencyCode;
  participantCount: number;
}

export interface PartyParticipant {
  id: string;
  partyId: string;
  kind: ParticipantKind;
  displayName: string;
  userId?: string;
  accountId?: string;
}

export interface Party {
  id: string;
  accountId: string;
  name: string;
  participants: PartyParticipant[];
  createdAt: string;
}

export interface Split {
  id: string;
  accountId: string;
  partyId: string;
  expenseId: string;
  paidByParticipantId?: string;
  participantId: string;
  amount: Money;
  status: "open" | "settlement_pending" | "settled";
  createdAt: string;
  updatedAt: string;
}

export interface Settlement {
  id: string;
  accountId: string;
  partyId: string;
  splitId: string;
  participantId: string;
  participantKind: ParticipantKind;
  amount: Money;
  status: SettlementStatus;
  requiresApproval: boolean;
  requestedAt: string;
  approvedAt?: string;
  approvalReason?: string;
}

export interface ImportRow {
  id: string;
  batchId: string;
  status: ImportRowStatus;
  merchant: string;
  categoryId?: string;
  spentAt: string;
  original: Money;
  suggestedCategoryName: string;
  confidence: number;
  rawText?: string;
  possibleDuplicates?: Array<{
    type: "expense" | "importRow";
    id: string;
    batchId?: string;
    merchant: string;
    spentAt: string;
    original: Money;
  }>;
}

export interface ImportBatch {
  id: string;
  accountId: string;
  fileName: string;
  fileHash?: string;
  status: "processing" | "review" | "approved" | "failed";
  rows: ImportRow[];
  createdAt: string;
}

export interface ReportSummary {
  totalSpent: Money;
  budgetUsage: number;
  pendingSyncCount: number;
  categoryBreakdown: Array<{ category: string; amount: number; color: string }>;
  monthlyTrend: Array<{ month: string; amount: number }>;
  tripSpend: Array<{ trip: string; amount: number }>;
  partyBalances: Array<{ party: string; outstanding: number; settled: number }>;
}
