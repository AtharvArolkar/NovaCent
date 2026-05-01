import type {
  BudgetVarianceRow,
  ImportReviewBatch,
  ReportBudget,
  ReportExpense,
  ReportFilters,
  ReportParty,
  ReportRecurringRule,
  ReportTrip,
  SummaryBucket,
} from "./types";

const DEFAULT_BUDGET_THRESHOLD = 80;

const toTime = (date: string) => new Date(date).getTime();

const isExpenseValue = (expense: ReportExpense) =>
  expense.direction === undefined || expense.direction === "expense";

const valueOf = (expense: ReportExpense) =>
  isExpenseValue(expense) ? expense.baseAmount : -expense.baseAmount;

export const filterReportExpenses = (
  expenses: ReportExpense[],
  filters: ReportFilters = {},
) =>
  expenses.filter((expense) => {
    if (filters.accountId && expense.accountId !== filters.accountId) return false;
    if (filters.categoryId && expense.categoryId !== filters.categoryId) return false;
    if (filters.tripId && expense.tripId !== filters.tripId) return false;
    if (filters.partyId && expense.partyId !== filters.partyId) return false;
    if (filters.currency && expense.currency !== filters.currency) return false;
    if (filters.startDate && toTime(expense.spentAt) < toTime(filters.startDate)) {
      return false;
    }
    if (filters.endDate && toTime(expense.spentAt) > toTime(filters.endDate)) {
      return false;
    }
    return true;
  });

const pushBucket = (
  buckets: Map<string, SummaryBucket>,
  id: string,
  label: string,
  amount: number,
) => {
  const current = buckets.get(id) ?? { id, label, amount: 0, count: 0 };
  current.amount += amount;
  current.count += 1;
  buckets.set(id, current);
};

const sortedBuckets = (buckets: Map<string, SummaryBucket>) =>
  Array.from(buckets.values()).sort((left, right) => right.amount - left.amount);

export const aggregateByCategory = (
  expenses: ReportExpense[],
  filters?: ReportFilters,
) => {
  const buckets = new Map<string, SummaryBucket>();

  for (const expense of filterReportExpenses(expenses, filters)) {
    const id = expense.categoryId ?? "uncategorized";
    const label = expense.categoryName ?? "Uncategorized";
    pushBucket(buckets, id, label, valueOf(expense));
  }

  return sortedBuckets(buckets);
};

export const aggregateByMonth = (
  expenses: ReportExpense[],
  filters?: ReportFilters,
) => {
  const buckets = new Map<string, SummaryBucket>();

  for (const expense of filterReportExpenses(expenses, filters)) {
    const date = new Date(expense.spentAt);
    const id = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
      2,
      "0",
    )}`;
    pushBucket(buckets, id, id, valueOf(expense));
  }

  return Array.from(buckets.values()).sort((left, right) =>
    left.id.localeCompare(right.id),
  );
};

export const aggregateByMerchant = (
  expenses: ReportExpense[],
  filters?: ReportFilters,
) => {
  const buckets = new Map<string, SummaryBucket>();

  for (const expense of filterReportExpenses(expenses, filters)) {
    const label = expense.merchant?.trim() || "Unknown merchant";
    pushBucket(buckets, label.toLowerCase(), label, valueOf(expense));
  }

  return sortedBuckets(buckets);
};

export const calculateBudgetVariance = (
  expenses: ReportExpense[],
  budgets: ReportBudget[],
  filters: ReportFilters = {},
): BudgetVarianceRow[] =>
  budgets
    .filter((budget) => !filters.accountId || budget.accountId === filters.accountId)
    .map((budget) => {
      const actualAmount = filterReportExpenses(expenses, {
        ...filters,
        accountId: budget.accountId,
        categoryId: budget.categoryId,
        startDate: budget.periodStart,
        endDate: budget.periodEnd,
      }).reduce((total, expense) => total + Math.max(valueOf(expense), 0), 0);
      const usagePercent =
        budget.limitAmount > 0 ? (actualAmount / budget.limitAmount) * 100 : 0;
      const alertThresholdPercent =
        budget.alertThresholdPercent ?? DEFAULT_BUDGET_THRESHOLD;

      return {
        budgetId: budget.id,
        categoryId: budget.categoryId,
        categoryName: budget.categoryName ?? "All categories",
        limitAmount: budget.limitAmount,
        actualAmount,
        remainingAmount: budget.limitAmount - actualAmount,
        usagePercent,
        alertThresholdPercent,
        isOverThreshold: usagePercent >= alertThresholdPercent,
        isOverBudget: actualAmount > budget.limitAmount,
      };
    })
    .sort((left, right) => right.usagePercent - left.usagePercent);

export const aggregateTrips = (
  expenses: ReportExpense[],
  trips: ReportTrip[],
  filters: ReportFilters = {},
) =>
  trips
    .filter((trip) => !filters.accountId || trip.accountId === filters.accountId)
    .map((trip) => {
      const tripExpenses = filterReportExpenses(expenses, {
        ...filters,
        accountId: trip.accountId,
        tripId: trip.id,
      });

      return {
        tripId: trip.id,
        tripName: trip.name,
        totalAmount: tripExpenses.reduce((total, expense) => total + valueOf(expense), 0),
        expenseCount: tripExpenses.length,
        byCategory: aggregateByCategory(tripExpenses),
        byCurrency: aggregateByCurrency(tripExpenses),
      };
    })
    .sort((left, right) => right.totalAmount - left.totalAmount);

export const aggregateByCurrency = (
  expenses: ReportExpense[],
  filters?: ReportFilters,
) => {
  const buckets = new Map<string, SummaryBucket>();

  for (const expense of filterReportExpenses(expenses, filters)) {
    pushBucket(buckets, expense.currency, expense.currency, expense.amount);
  }

  return sortedBuckets(buckets);
};

export const aggregateParties = (
  expenses: ReportExpense[],
  parties: ReportParty[],
  filters: ReportFilters = {},
) =>
  parties
    .filter((party) => !filters.accountId || party.accountId === filters.accountId)
    .map((party) => {
      const partyExpenses = filterReportExpenses(expenses, {
        ...filters,
        accountId: party.accountId,
        partyId: party.id,
      });
      const byParticipant = new Map<string, SummaryBucket>();

      for (const expense of partyExpenses) {
        const participant = party.participants.find(
          (candidate) => candidate.id === expense.participantId,
        );
        const label = participant?.displayName ?? "Unassigned";
        pushBucket(byParticipant, expense.participantId ?? "unassigned", label, valueOf(expense));
      }

      return {
        partyId: party.id,
        partyName: party.name,
        totalAmount: partyExpenses.reduce((total, expense) => total + valueOf(expense), 0),
        expenseCount: partyExpenses.length,
        byParticipant: sortedBuckets(byParticipant),
        byCategory: aggregateByCategory(partyExpenses),
      };
    })
    .sort((left, right) => right.totalAmount - left.totalAmount);

export const summarizeRecurringExpenses = (
  expenses: ReportExpense[],
  recurringRules: ReportRecurringRule[],
  filters: ReportFilters = {},
) =>
  recurringRules
    .filter((rule) => !filters.accountId || rule.accountId === filters.accountId)
    .map((rule) => {
      const occurrences = filterReportExpenses(expenses, {
        ...filters,
        accountId: rule.accountId,
      }).filter((expense) => expense.recurringRuleId === rule.id);

      return {
        recurringRuleId: rule.id,
        name: rule.name,
        categoryName: rule.categoryName ?? "Uncategorized",
        forecastMonthlyAmount: rule.baseAmount,
        actualAmount: occurrences.reduce((total, expense) => total + valueOf(expense), 0),
        occurrenceCount: occurrences.length,
        startDate: rule.startDate,
        endDate: rule.endDate,
      };
    })
    .sort((left, right) => right.actualAmount - left.actualAmount);

export const summarizeImportReviews = (batches: ImportReviewBatch[]) =>
  batches.map((batch) => {
    const approved = batch.rows.filter((row) => row.status === "approved");
    const deleted = batch.rows.filter((row) => row.status === "deleted");
    const pending = batch.rows.filter((row) => row.status === "pending");
    const confidenceValues = batch.rows
      .map((row) => row.confidence)
      .filter((confidence): confidence is number => typeof confidence === "number");

    return {
      batchId: batch.id,
      originalFileName: batch.originalFileName,
      uploadedAt: batch.uploadedAt,
      rowCount: batch.rows.length,
      approvedCount: approved.length,
      deletedCount: deleted.length,
      pendingCount: pending.length,
      approvedAmount: approved.reduce((total, row) => total + row.amount, 0),
      averageConfidence:
        confidenceValues.length > 0
          ? confidenceValues.reduce((total, confidence) => total + confidence, 0) /
            confidenceValues.length
          : undefined,
    };
  });

