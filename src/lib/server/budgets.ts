import type { Expense } from "@/lib/domain";
import { collections, getDb } from "@/lib/server/mongodb";
import { createNotification } from "@/lib/server/notifications";

export async function applyExpenseBudgetImpact(expense: Expense, userId?: string) {
  const db = await getDb();
  const budget = await db.collection(collections.budgets).findOne({
    accountId: expense.accountId,
    categoryId: expense.categoryId
  });

  if (!budget) {
    return;
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
      body: `${budget.categoryName} is at ${Math.round(nextPercent)}% of the monthly budget.`,
      tone: "warning",
      eventType: "budget_threshold",
      entityType: "budget",
      entityId: budget.id
    });
  }
}
