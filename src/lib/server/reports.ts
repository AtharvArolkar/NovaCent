import type { Budget, Expense, ReportSummary, Split, Trip } from "@/lib/domain";
import { appConfig } from "@/lib/app-config";

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function reportCategoryFor(expense: Expense, expensesById: Map<string, Expense>, splitsById: Map<string, Split>) {
  if (expense.source !== "settlement" || !expense.splitId) {
    return expense.categoryName;
  }

  const split = splitsById.get(expense.splitId);
  const sourceExpense = split?.expenseId ? expensesById.get(split.expenseId) : undefined;
  return sourceExpense?.categoryName ?? expense.categoryName;
}

export function buildReportSummary(expenses: Expense[], budgets: Budget[], trips: Trip[], splits: Split[] = [], relatedExpenses: Expense[] = []): ReportSummary {
  const total = expenses.reduce((sum, expense) => sum + expense.base.amount, 0);
  const pendingSyncCount = expenses.filter((expense) => expense.syncStatus === "pending").length;
  const budgetTotal = budgets.reduce((sum, budget) => sum + budget.limit.amount, 0);
  const budgetSpent = budgets.reduce((sum, budget) => sum + budget.spent.amount, 0);
  const byCategory = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const byTrip = new Map<string, number>();
  const expensesById = new Map([...relatedExpenses, ...expenses].map((expense) => [expense.id, expense]));
  const splitsById = new Map(splits.map((split) => [split.id, split]));

  for (const expense of expenses) {
    const reportCategory = reportCategoryFor(expense, expensesById, splitsById);
    byCategory.set(reportCategory, (byCategory.get(reportCategory) ?? 0) + expense.base.amount);
    const month = new Date(expense.spentAt).toLocaleString("en", { month: "short" });
    byMonth.set(month, (byMonth.get(month) ?? 0) + expense.base.amount);
    if (expense.tripId) {
      const trip = trips.find((item) => item.id === expense.tripId);
      const name = trip?.name ?? "Trip";
      byTrip.set(name, (byTrip.get(name) ?? 0) + expense.base.amount);
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
    monthlyTrend: Array.from(byMonth.entries()).map(([month, amount]) => ({ month, amount: roundMoney(amount) })),
    tripSpend: Array.from(byTrip.entries()).map(([trip, amount]) => ({ trip, amount: roundMoney(amount) })),
    partyBalances: []
  };
}
