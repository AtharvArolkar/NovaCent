import type { Budget, Expense, Party, ReportSummary, Settlement, Split, Trip } from "@/lib/domain";
import { appConfig } from "@/lib/app-config";
import { investmentAmountForSignedAmount, spendImpactForSignedAmount } from "@/lib/spend-impact";

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function amountFrom(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && "amount" in value) {
    const amount = Number((value as { amount?: unknown }).amount);
    return Number.isFinite(amount) ? amount : 0;
  }
  return 0;
}

function currencyFrom(value: unknown, fallback: string = appConfig.baseCurrency) {
  if (value && typeof value === "object" && "currency" in value) {
    const currency = (value as { currency?: unknown }).currency;
    return typeof currency === "string" && currency.trim() ? currency : fallback;
  }
  return fallback;
}

function expenseBaseAmount(expense: Expense) {
  return amountFrom(expense.base) || amountFrom(expense.original) || amountFrom((expense as Expense & { amount?: unknown }).amount);
}

function spendImpactAmount(expense: Expense) {
  const amount = expenseBaseAmount(expense);
  return spendImpactForSignedAmount(amount, expense);
}

function investmentImpactAmount(expense: Expense) {
  const amount = expenseBaseAmount(expense);
  return investmentAmountForSignedAmount(amount, expense);
}

function expenseOriginalAmount(expense: Expense) {
  return amountFrom(expense.original) || expenseBaseAmount(expense);
}

function expenseMonthLabel(expense: Expense) {
  const spentAt = expense.spentAt || (expense as Expense & { date?: string }).date;
  const parsed = new Date(spentAt ?? "");
  if (Number.isNaN(parsed.getTime())) return "Undated";
  return parsed.toLocaleString("en", { month: "short", year: "2-digit" });
}

function expenseCategoryName(expense: Expense) {
  return expense.categoryName || (expense as Expense & { category?: string }).category || "Uncategorized";
}

function budgetLimitAmount(budget: Budget) {
  return amountFrom(budget.limit);
}

function reportCategoryFor(expense: Expense, expensesById: Map<string, Expense>, splitsById: Map<string, Split>) {
  if (expense.source !== "settlement" || !expense.splitId) {
    return expenseCategoryName(expense);
  }

  const split = splitsById.get(expense.splitId);
  const sourceExpense = split?.expenseId ? expensesById.get(split.expenseId) : undefined;
  return (sourceExpense ? expenseCategoryName(sourceExpense) : undefined) ?? expenseCategoryName(expense);
}

export function buildReportSummary(expenses: Expense[], budgets: Budget[], trips: Trip[], splits: Split[] = [], relatedExpenses: Expense[] = []): ReportSummary {
  const total = Math.max(0, roundMoney(expenses.reduce((sum, expense) => sum + spendImpactAmount(expense), 0)));
  const pendingSyncCount = expenses.filter((expense) => expense.syncStatus === "pending").length;
  const budgetTotal = budgets.reduce((sum, budget) => sum + budgetLimitAmount(budget), 0);
  const budgetSpent = budgets.reduce((sum, budget) => sum + amountFrom(budget.spent), 0);
  const byCategory = new Map<string, number>();
  const byMonth = new Map<string, { amount: number; income: number; spend: number }>();
  const investmentsByMonth = new Map<string, number>();
  const byTrip = new Map<string, number>();
  const byCurrency = new Map<string, number>();
  const merchantTrendMonths = new Map<string, { food: number; travel: number; shopping: number; subscriptions: number }>();
  const expensesById = new Map([...relatedExpenses, ...expenses].map((expense) => [expense.id, expense]));
  const splitsById = new Map(splits.map((split) => [split.id, split]));

  for (const expense of expenses) {
    const reportCategory = reportCategoryFor(expense, expensesById, splitsById);
    const baseAmount = expenseBaseAmount(expense);
    const spendImpact = spendImpactAmount(expense);
    const investmentImpact = investmentImpactAmount(expense);
    const month = expenseMonthLabel(expense);

    if (investmentImpact > 0) {
      investmentsByMonth.set(month, (investmentsByMonth.get(month) ?? 0) + investmentImpact);
    }

    byCategory.set(reportCategory, (byCategory.get(reportCategory) ?? 0) + spendImpact);
    const monthBucket = byMonth.get(month) ?? { amount: 0, income: 0, spend: 0 };
    monthBucket.amount += spendImpact;
    if (investmentImpact > 0) {
      // Investment purchases are tracked separately from operating cash flow.
    } else if (baseAmount < 0) {
      monthBucket.income += Math.abs(baseAmount);
    } else {
      monthBucket.spend += Math.max(spendImpact, 0);
    }
    byMonth.set(month, monthBucket);
    const originalCurrency = currencyFrom(expense.original, (expense as Expense & { currency?: string }).currency || appConfig.baseCurrency);
    if (spendImpact > 0) {
      byCurrency.set(originalCurrency, (byCurrency.get(originalCurrency) ?? 0) + Math.max(expenseOriginalAmount(expense), 0));
    }
    const trendBucket = merchantTrendMonths.get(month) ?? { food: 0, travel: 0, shopping: 0, subscriptions: 0 };
    const categoryKey = reportCategory.toLowerCase();
    const trendSpend = Math.max(spendImpact, 0);
    if (categoryKey.includes("food")) {
      trendBucket.food += trendSpend;
    } else if (categoryKey.includes("travel")) {
      trendBucket.travel += trendSpend;
    } else if (categoryKey.includes("shopping")) {
      trendBucket.shopping += trendSpend;
    } else if (categoryKey.includes("subscription")) {
      trendBucket.subscriptions += trendSpend;
    }
    merchantTrendMonths.set(month, trendBucket);
    if (expense.tripId) {
      const trip = trips.find((item) => item.id === expense.tripId);
      const name = trip?.name ?? "Trip";
      byTrip.set(name, (byTrip.get(name) ?? 0) + baseAmount);
    }
  }

  const colors = ["#0f766e", "#2563eb", "#b45309", "#be123c", "#7c3aed", "#0891b2"];

  return {
    totalSpent: { amount: roundMoney(total), currency: appConfig.baseCurrency },
    budgetUsage: budgetTotal ? Math.round((budgetSpent / budgetTotal) * 100) : 0,
    pendingSyncCount,
    categoryBreakdown: Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount: roundMoney(amount) }))
      .filter((row) => row.amount > 0)
      .map((row, index) => ({
        ...row,
        color: colors[index % colors.length]
      })),
    monthlyTrend: Array.from(byMonth.entries()).map(([month, bucket]) => ({
      month,
      amount: roundMoney(bucket.amount),
      income: roundMoney(bucket.income),
      spend: roundMoney(bucket.spend)
    })),
    investmentTrend: Array.from(investmentsByMonth.entries()).map(([month, amount]) => ({
      month,
      amount: roundMoney(amount)
    })),
    budgetVariance: budgets.map((budget) => ({
      categoryName: budget.scope === "overall" ? "Overall spend" : budget.categoryName,
      limitAmount: roundMoney(budgetLimitAmount(budget)),
      actualAmount: roundMoney(Math.max(0, budget.scope === "overall" ? total : byCategory.get(budget.categoryName) ?? 0)),
      remainingAmount: roundMoney(budgetLimitAmount(budget) - Math.max(0, budget.scope === "overall" ? total : byCategory.get(budget.categoryName) ?? 0)),
      usagePercent: budgetLimitAmount(budget) > 0 ? Math.round((Math.max(0, budget.scope === "overall" ? total : byCategory.get(budget.categoryName) ?? 0) / budgetLimitAmount(budget)) * 100) : 0
    })),
    merchantTrends: Array.from(merchantTrendMonths.entries()).map(([month, bucket]) => ({
      month,
      food: roundMoney(bucket.food),
      travel: roundMoney(bucket.travel),
      shopping: roundMoney(bucket.shopping),
      subscriptions: roundMoney(bucket.subscriptions)
    })),
    tripSpend: Array.from(byTrip.entries()).map(([trip, amount]) => ({ trip, amount: roundMoney(amount) })),
    partyBalances: [],
    currencyExposure: Array.from(byCurrency.entries()).map(([currency, amount]) => ({ currency, amount: roundMoney(amount) }))
  };
}

export function attachPartyBalances(summary: ReportSummary, parties: Party[], splits: Split[], settlements: Settlement[]): ReportSummary {
  const partyBalances = parties.map((party) => {
    const partySplits = splits.filter((split) => split.partyId === party.id);
    const partySettlements = settlements.filter((settlement) => settlement.partyId === party.id);
    return {
      party: party.name,
      outstanding: roundMoney(
        partySplits
          .filter((split) => split.status !== "settled")
          .reduce((sum, split) => sum + amountFrom(split.amount), 0)
      ),
      settled: roundMoney(
        partySettlements
          .filter((settlement) => settlement.status === "settled")
          .reduce((sum, settlement) => sum + amountFrom(settlement.amount), 0)
      )
    };
  });

  return {
    ...summary,
    partyBalances
  };
}
