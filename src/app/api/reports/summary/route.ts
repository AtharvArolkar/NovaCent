import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { buildReportSummary } from "@/lib/server/reports";
import { handleApiError, ok } from "@/lib/server/http";
import type { Budget, Expense, Split } from "@/lib/domain";

export async function GET(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const [expenses, budgets] = await Promise.all([
      db.collection<Expense>(collections.expenses).find({ accountId, excludeFromLedger: { $ne: true } }).sort({ spentAt: -1 }).limit(500).toArray(),
      db.collection<Budget>(collections.budgets).find({ accountId }).toArray()
    ]);
    const settlementSplitIds = Array.from(
      new Set(expenses.filter((expense) => expense.source === "settlement" && expense.splitId).map((expense) => expense.splitId as string))
    );
    const splits = settlementSplitIds.length
      ? await db.collection<Split>(collections.splits).find({ id: { $in: settlementSplitIds } }).toArray()
      : [];
    const sourceExpenseIds = Array.from(new Set(splits.map((split) => split.expenseId).filter(Boolean)));
    const sourceExpenses = sourceExpenseIds.length
      ? await db.collection<Expense>(collections.expenses).find({ id: { $in: sourceExpenseIds } }).toArray()
      : [];

    return ok({ report: buildReportSummary(expenses, budgets, [], splits, sourceExpenses) });
  } catch (error) {
    return handleApiError(error);
  }
}
