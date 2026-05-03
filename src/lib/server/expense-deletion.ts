import type { Db } from "mongodb";
import type { Expense, Split } from "@/lib/domain";
import { reverseExpensesBudgetImpact } from "@/lib/server/budgets";
import { collections } from "@/lib/server/mongodb";

export interface BulkExpenseDeleteResult {
  requestedCount: number;
  deletedCount: number;
  skippedCount: number;
  deletedIds: string[];
  skippedIds: string[];
}

async function settledPartyExpenseIds(db: Db, accountId: string, expenses: Expense[]) {
  const partyExpenseIds = expenses.filter((expense) => expense.partyId).map((expense) => expense.id);
  const lockedIds = new Set<string>();

  if (!partyExpenseIds.length) {
    return lockedIds;
  }

  const splitRows = await db.collection<Split>(collections.splits)
    .find({ accountId, expenseId: { $in: partyExpenseIds } })
    .project<Pick<Split, "id" | "expenseId" | "status">>({ id: 1, expenseId: 1, status: 1 })
    .toArray();

  for (const split of splitRows) {
    if (split.status === "settled") {
      lockedIds.add(split.expenseId);
    }
  }

  const splitToExpenseId = new Map(splitRows.map((split) => [split.id, split.expenseId]));
  const splitIds = Array.from(splitToExpenseId.keys());
  if (!splitIds.length) {
    return lockedIds;
  }

  const settledSettlements = await db.collection(collections.settlements)
    .find({ accountId, splitId: { $in: splitIds }, status: "settled" })
    .project<{ splitId: string }>({ splitId: 1 })
    .toArray();

  for (const settlement of settledSettlements) {
    const expenseId = splitToExpenseId.get(settlement.splitId);
    if (expenseId) {
      lockedIds.add(expenseId);
    }
  }

  return lockedIds;
}

export async function deleteExpensesForAccount(db: Db, accountId: string, expenseIds: string[]): Promise<BulkExpenseDeleteResult> {
  const uniqueExpenseIds = Array.from(new Set(expenseIds.filter(Boolean)));
  const result: BulkExpenseDeleteResult = {
    requestedCount: uniqueExpenseIds.length,
    deletedCount: 0,
    skippedCount: 0,
    deletedIds: [],
    skippedIds: []
  };

  if (!uniqueExpenseIds.length) {
    return result;
  }

  const expenses = await db.collection<Expense>(collections.expenses)
    .find({ accountId, id: { $in: uniqueExpenseIds } })
    .toArray();
  const foundIds = new Set(expenses.map((expense) => expense.id));
  const lockedPartyExpenseIds = await settledPartyExpenseIds(db, accountId, expenses);
  const deletableExpenses: Expense[] = [];
  const skippedIds = new Set(uniqueExpenseIds.filter((id) => !foundIds.has(id)));

  for (const expense of expenses) {
    if (expense.source === "settlement" || expense.settlementId || lockedPartyExpenseIds.has(expense.id)) {
      skippedIds.add(expense.id);
      continue;
    }

    deletableExpenses.push(expense);
  }

  const deletableExpenseIds = deletableExpenses.map((expense) => expense.id);
  if (!deletableExpenseIds.length) {
    result.skippedIds = Array.from(skippedIds);
    result.skippedCount = result.skippedIds.length;
    return result;
  }

  const splitRows = await db.collection<Split>(collections.splits)
    .find({ accountId, expenseId: { $in: deletableExpenseIds } })
    .project<Pick<Split, "id">>({ id: 1 })
    .toArray();
  const splitIds = splitRows.map((split) => split.id);

  await Promise.all([
    db.collection(collections.expenses).deleteMany({ accountId, id: { $in: deletableExpenseIds } }),
    db.collection(collections.splits).deleteMany({ accountId, expenseId: { $in: deletableExpenseIds } }),
    splitIds.length
      ? db.collection(collections.settlements).deleteMany({ accountId, splitId: { $in: splitIds } })
      : Promise.resolve(),
    splitIds.length
      ? db.collection(collections.expenses).deleteMany({ accountId, settlementId: { $in: splitIds } })
      : Promise.resolve()
  ]);
  await reverseExpensesBudgetImpact(deletableExpenses);

  result.deletedIds = deletableExpenseIds;
  result.deletedCount = deletableExpenseIds.length;
  result.skippedIds = Array.from(skippedIds);
  result.skippedCount = result.skippedIds.length;
  return result;
}
