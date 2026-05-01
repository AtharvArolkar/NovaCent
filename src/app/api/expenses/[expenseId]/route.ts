import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { reverseExpenseBudgetImpact } from "@/lib/server/budgets";
import { hasSettledPartyExpense } from "@/lib/server/delete-guards";
import { handleApiError, ok, problem } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";
import type { Expense } from "@/lib/domain";

interface RouteContext {
  params: Promise<{ expenseId: string }> | { expenseId: string };
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { expenseId } = await context.params;
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const expense = await db.collection<Expense>(collections.expenses).findOne({ id: expenseId, accountId });

    if (!expense) {
      return problem("Expense was not found.", 404);
    }

    if (expense.source === "settlement" || expense.settlementId) {
      return problem("Settlement ledger entries cannot be deleted directly.", 409);
    }

    if (expense.partyId && await hasSettledPartyExpense(db, { accountId, partyId: expense.partyId, expenseId })) {
      return problem("Settled party expenses cannot be deleted.", 409);
    }

    const splitIds = await db.collection(collections.splits).find({ accountId, expenseId }).project({ id: 1 }).toArray();
    await Promise.all([
      db.collection(collections.expenses).deleteOne({ id: expenseId, accountId }),
      db.collection(collections.splits).deleteMany({ accountId, expenseId }),
      splitIds.length
        ? db.collection(collections.settlements).deleteMany({ accountId, splitId: { $in: splitIds.map((split) => split.id) } })
        : Promise.resolve(),
      db.collection(collections.expenses).deleteMany({ accountId, settlementId: { $in: splitIds.map((split) => split.id) } })
    ]);
    await reverseExpenseBudgetImpact(expense);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
