import type { Db } from "mongodb";
import type { Budget, BudgetIncludedExpense, BudgetPeriod, BudgetScope, Expense, Split } from "@/lib/domain";
import { collections, getDb } from "@/lib/server/mongodb";
import { createNotification } from "@/lib/server/notifications";

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function periodLabel(period?: BudgetPeriod) {
  return period === "yearly" ? "yearly" : "monthly";
}

function periodBounds(period: BudgetPeriod = "monthly", now = new Date()) {
  const start = period === "yearly"
    ? new Date(now.getFullYear(), 0, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = period === "yearly"
    ? new Date(now.getFullYear() + 1, 0, 1)
    : new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return { start, end };
}

function expenseInPeriod(expense: Expense, period: BudgetPeriod = "monthly") {
  const spentAt = new Date(expense.spentAt);
  const { start, end } = periodBounds(period);
  return spentAt >= start && spentAt < end;
}

function normalizedCategoryName(categoryName?: string) {
  return categoryName?.trim().toLowerCase() ?? "";
}

function budgetScope(budget: Pick<Budget, "scope" | "categoryId" | "categoryName">): BudgetScope {
  if (budget.scope === "overall" || budget.categoryId === "all-categories") {
    return "overall";
  }

  // Backward compatibility for budgets already created as names like "Monthly Budget".
  return normalizedCategoryName(budget.categoryName).includes("budget") ? "overall" : "category";
}

function categoryKeys(categoryId?: string, categoryName?: string) {
  return [
    categoryId ? `id:${categoryId}` : "",
    normalizedCategoryName(categoryName) ? `name:${normalizedCategoryName(categoryName)}` : ""
  ].filter(Boolean);
}

function includedExpenseFrom(expense: Expense, category: { categoryName?: string }): BudgetIncludedExpense {
  return {
    id: expense.id,
    date: expense.spentAt.slice(0, 10),
    merchant: expense.merchant,
    categoryName: category.categoryName ?? expense.categoryName,
    amount: roundMoney(expense.base.amount),
    currency: expense.base.currency,
    source: expense.source
  };
}

function addSpend(
  spendByCategory: Map<string, number>,
  expensesByCategory: Map<string, BudgetIncludedExpense[]>,
  key: string,
  expense: BudgetIncludedExpense
) {
  spendByCategory.set(key, (spendByCategory.get(key) ?? 0) + expense.amount);
  expensesByCategory.set(key, [...(expensesByCategory.get(key) ?? []), expense]);
}

function budgetCategoryFor(expense: Expense, expensesById: Map<string, Expense>, splitsById: Map<string, Split>) {
  if (expense.source !== "settlement" || !expense.splitId) {
    return { categoryId: expense.categoryId, categoryName: expense.categoryName };
  }

  const split = splitsById.get(expense.splitId);
  const sourceExpense = split?.expenseId ? expensesById.get(split.expenseId) : undefined;
  return {
    categoryId: sourceExpense?.categoryId ?? expense.categoryId,
    categoryName: sourceExpense?.categoryName ?? expense.categoryName
  };
}

async function budgetCalculationByCategory(db: Db, accountId: string, period: BudgetPeriod = "monthly") {
  const expenses = await db.collection<Expense>(collections.expenses).find({ accountId, excludeFromLedger: { $ne: true } }).sort({ spentAt: -1, createdAt: -1 }).toArray();
  const periodExpenses = expenses.filter((expense) => expenseInPeriod(expense, period));
  const settlementSplitIds = Array.from(
    new Set(periodExpenses.filter((expense) => expense.source === "settlement" && expense.splitId).map((expense) => expense.splitId as string))
  );
  const splits = settlementSplitIds.length
    ? await db.collection<Split>(collections.splits).find({ id: { $in: settlementSplitIds } }).toArray()
    : [];
  const sourceExpenseIds = Array.from(new Set(splits.map((split) => split.expenseId).filter(Boolean)));
  const sourceExpenses = sourceExpenseIds.length
    ? await db.collection<Expense>(collections.expenses).find({ id: { $in: sourceExpenseIds } }).toArray()
    : [];
  const expensesById = new Map([...sourceExpenses, ...expenses].map((expense) => [expense.id, expense]));
  const splitsById = new Map(splits.map((split) => [split.id, split]));
  const spendByCategory = new Map<string, number>();
  const expensesByCategory = new Map<string, BudgetIncludedExpense[]>();

  for (const expense of periodExpenses) {
    const category = budgetCategoryFor(expense, expensesById, splitsById);
    const includedExpense = includedExpenseFrom(expense, category);
    addSpend(spendByCategory, expensesByCategory, "scope:overall", includedExpense);
    for (const key of categoryKeys(category.categoryId, category.categoryName)) {
      addSpend(spendByCategory, expensesByCategory, key, includedExpense);
    }
  }

  return { spendByCategory, expensesByCategory };
}

export async function hydrateBudgetSpend(db: Db, accountId: string, budgets: Budget[]) {
  const periodSpend = new Map<BudgetPeriod, Awaited<ReturnType<typeof budgetCalculationByCategory>>>();
  const spendForPeriod = async (period: BudgetPeriod) => {
    const existing = periodSpend.get(period);
    if (existing) return existing;
    const next = await budgetCalculationByCategory(db, accountId, period);
    periodSpend.set(period, next);
    return next;
  };

  const hydratedBudgets = await Promise.all(budgets.map(async (budget) => {
    const period = budget.period ?? "monthly";
    const { spendByCategory, expensesByCategory } = await spendForPeriod(period);
    const scope = budgetScope(budget);
    const categoryKey = scope === "overall"
      ? "scope:overall"
      : spendByCategory.has(`id:${budget.categoryId}`)
        ? `id:${budget.categoryId}`
        : `name:${normalizedCategoryName(budget.categoryName)}`;
    return {
      ...budget,
      scope,
      period,
      spent: {
        amount: Math.max(0, roundMoney(
          spendByCategory.get(categoryKey) ?? 0
        )),
        currency: budget.limit.currency
      },
      includedExpenses: expensesByCategory.get(categoryKey) ?? []
    };
  }));

  return hydratedBudgets;
}

export async function calculatedBudgetSpent(db: Db, input: { accountId: string; scope?: BudgetScope; categoryId: string; categoryName?: string; currency: string; period?: BudgetPeriod }) {
  const { spendByCategory } = await budgetCalculationByCategory(db, input.accountId, input.period ?? "monthly");
  return {
    amount: Math.max(0, roundMoney(
      input.scope === "overall"
        ? spendByCategory.get("scope:overall") ?? 0
        : spendByCategory.get(`id:${input.categoryId}`) ??
          spendByCategory.get(`name:${normalizedCategoryName(input.categoryName)}`) ??
          0
    )),
    currency: input.currency
  };
}

export async function applyExpenseBudgetImpact(expense: Expense, userId?: string) {
  if (expense.excludeFromLedger || expense.source === "settlement" || expense.base.amount <= 0) {
    return;
  }

  const db = await getDb();
  const budgets = await db.collection<Budget>(collections.budgets).find({ accountId: expense.accountId }).toArray();

  if (!budgets.length) {
    return;
  }

  for (const budget of budgets) {
    const scope = budgetScope(budget);
    const categoryMatches =
      scope === "overall" ||
      budget.categoryId === expense.categoryId ||
      normalizedCategoryName(budget.categoryName) === normalizedCategoryName(expense.categoryName);
    if (!categoryMatches) {
      continue;
    }

    if (!expenseInPeriod(expense, budget.period ?? "monthly")) {
      continue;
    }

    const previousSpent = Number(budget.spent?.amount ?? 0);
    const nextSpent = Math.round((previousSpent + expense.base.amount) * 100) / 100;
    await db.collection(collections.budgets).updateOne(
      { id: budget.id, accountId: expense.accountId },
      {
        $set: {
          spent: { amount: nextSpent, currency: budget.limit.currency },
          updatedAt: new Date().toISOString()
        }
      }
    );

    const limit = Number(budget.limit.amount);
    const threshold = Number(budget.alertThreshold ?? 100);
    const previousPercent = limit > 0 ? (previousSpent / limit) * 100 : 0;
    const nextPercent = limit > 0 ? (nextSpent / limit) * 100 : 0;

    if (limit > 0 && previousPercent < threshold && nextPercent >= threshold) {
      await createNotification({
        accountId: expense.accountId,
        userId,
        title: "Budget threshold reached",
        body: `${budget.categoryName} is at ${Math.round(nextPercent)}% of the ${periodLabel(budget.period)} budget.`,
        tone: "warning",
        eventType: "budget_threshold",
        entityType: "budget",
        entityId: budget.id
      });
    }
  }
}

export async function reverseExpenseBudgetImpact(expense: Expense) {
  if (expense.excludeFromLedger || expense.source === "settlement" || expense.base.amount <= 0) {
    return;
  }

  const db = await getDb();
  const budgets = await db.collection<Budget>(collections.budgets).find({ accountId: expense.accountId }).toArray();

  if (!budgets.length) {
    return;
  }

  await Promise.all(budgets.map(async (budget) => {
    const scope = budgetScope(budget);
    const categoryMatches =
      scope === "overall" ||
      budget.categoryId === expense.categoryId ||
      normalizedCategoryName(budget.categoryName) === normalizedCategoryName(expense.categoryName);
    if (!categoryMatches) {
      return;
    }

    if (!expenseInPeriod(expense, budget.period ?? "monthly")) {
      return;
    }

    const previousSpent = Number(budget.spent?.amount ?? 0);
    const nextSpent = Math.max(0, Math.round((previousSpent - expense.base.amount) * 100) / 100);
    await db.collection(collections.budgets).updateOne(
      { id: budget.id, accountId: expense.accountId },
      {
        $set: {
          spent: { amount: nextSpent, currency: budget.limit.currency },
          updatedAt: new Date().toISOString()
        }
      }
    );
  }));
}
