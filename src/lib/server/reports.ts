import type { Budget, Expense, ReportSummary, Trip } from "@/lib/domain";
import { appConfig } from "@/lib/app-config";

export function buildReportSummary(expenses: Expense[], budgets: Budget[], trips: Trip[]): ReportSummary {
  const total = expenses.reduce((sum, expense) => sum + expense.base.amount, 0);
  const pendingSyncCount = expenses.filter((expense) => expense.syncStatus === "pending").length;
  const budgetTotal = budgets.reduce((sum, budget) => sum + budget.limit.amount, 0);
  const budgetSpent = budgets.reduce((sum, budget) => sum + budget.spent.amount, 0);
  const byCategory = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const byTrip = new Map<string, number>();

  for (const expense of expenses) {
    byCategory.set(expense.categoryName, (byCategory.get(expense.categoryName) ?? 0) + expense.base.amount);
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
    totalSpent: { amount: Math.round(total * 100) / 100, currency: appConfig.baseCurrency },
    budgetUsage: budgetTotal ? Math.round((budgetSpent / budgetTotal) * 100) : 0,
    pendingSyncCount,
    categoryBreakdown: Array.from(byCategory.entries()).map(([category, amount], index) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      color: colors[index % colors.length]
    })),
    monthlyTrend: Array.from(byMonth.entries()).map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 })),
    tripSpend: Array.from(byTrip.entries()).map(([trip, amount]) => ({ trip, amount: Math.round(amount * 100) / 100 })),
    partyBalances: []
  };
}

