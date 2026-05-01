export type MoneyDirection = "expense" | "income" | "adjustment";

export interface ReportExpense {
  id: string;
  accountId: string;
  amount: number;
  baseAmount: number;
  currency: string;
  baseCurrency?: string;
  direction?: MoneyDirection;
  categoryId?: string;
  categoryName?: string;
  subcategoryName?: string;
  merchant?: string;
  spentAt: string;
  tripId?: string;
  partyId?: string;
  recurringRuleId?: string;
  importBatchId?: string;
  participantId?: string;
}

export interface ReportBudget {
  id: string;
  accountId: string;
  categoryId?: string;
  categoryName?: string;
  limitAmount: number;
  periodStart: string;
  periodEnd: string;
  alertThresholdPercent?: number;
}

export interface ReportTrip {
  id: string;
  name: string;
  accountId: string;
  participantIds?: string[];
}

export interface ReportPartyParticipant {
  id: string;
  displayName: string;
  kind: "registered" | "external";
}

export interface ReportParty {
  id: string;
  name: string;
  accountId: string;
  participants: ReportPartyParticipant[];
}

export interface ReportRecurringRule {
  id: string;
  accountId: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  amount: number;
  baseAmount: number;
  currency: string;
  startDate: string;
  endDate?: string;
}

export interface ImportReviewRow {
  id: string;
  batchId: string;
  status: "pending" | "approved" | "deleted" | "rejected";
  amount: number;
  confidence?: number;
  suggestedCategoryName?: string;
}

export interface ImportReviewBatch {
  id: string;
  accountId: string;
  originalFileName: string;
  uploadedAt: string;
  rows: ImportReviewRow[];
}

export interface ReportFilters {
  accountId?: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  tripId?: string;
  partyId?: string;
  currency?: string;
}

export interface SummaryBucket {
  id: string;
  label: string;
  amount: number;
  count: number;
}

export interface BudgetVarianceRow {
  budgetId: string;
  categoryId?: string;
  categoryName: string;
  limitAmount: number;
  actualAmount: number;
  remainingAmount: number;
  usagePercent: number;
  alertThresholdPercent: number;
  isOverThreshold: boolean;
  isOverBudget: boolean;
}

export interface AccessibleTableColumn<TRow> {
  key: keyof TRow | string;
  header: string;
  getValue?: (row: TRow) => string | number;
}

export interface AccessibleTableData<TRow> {
  caption: string;
  columns: AccessibleTableColumn<TRow>[];
  rows: TRow[];
}

