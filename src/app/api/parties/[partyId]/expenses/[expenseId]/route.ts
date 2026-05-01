import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { reverseExpenseBudgetImpact } from "@/lib/server/budgets";
import { hasSettledPartyExpense } from "@/lib/server/delete-guards";
import { handleApiError, ok, problem } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";
import { partyAccountIds } from "@/lib/server/party-access";
import type { Expense } from "@/lib/domain";

interface RouteContext {
  params: Promise<{ partyId: string; expenseId: string }> | { partyId: string; expenseId: string };
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { partyId, expenseId } = await context.params;
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const party = await db.collection(collections.parties).findOne({ id: partyId, accountId });

    if (!party) {
      return problem("Party was not found or you cannot manage it.", 404);
    }

    if (await hasSettledPartyExpense(db, { accountId, partyId, expenseId })) {
      return problem("Settled party expenses cannot be deleted.", 409);
    }

    const visibleExpenseAccountIds = partyAccountIds(party);
    const expense = await db.collection<Expense>(collections.expenses).findOne({
      id: expenseId,
      partyId,
      accountId: { $in: visibleExpenseAccountIds }
    });

    if (!expense) {
      return problem("Party expense was not found.", 404);
    }

    const splitIds = await db.collection(collections.splits).find({ accountId, partyId, expenseId }).project({ id: 1 }).toArray();
    await Promise.all([
      db.collection(collections.expenses).deleteOne({ id: expenseId, accountId: expense.accountId }),
      db.collection(collections.splits).deleteMany({ accountId, partyId, expenseId }),
      splitIds.length
        ? db.collection(collections.settlements).deleteMany({ accountId, partyId, splitId: { $in: splitIds.map((split) => split.id) } })
        : Promise.resolve()
    ]);
    await reverseExpenseBudgetImpact(expense);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
