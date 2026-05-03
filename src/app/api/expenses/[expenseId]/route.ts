import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { applyExpenseBudgetImpact, reverseExpenseBudgetImpact } from "@/lib/server/budgets";
import { hasSettledPartyExpense } from "@/lib/server/delete-guards";
import { handleApiError, ok, problem } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";
import { expensePatchSchema } from "@/lib/server/schemas";
import { classifyMoneyFlowType } from "@/lib/spend-impact";
import type { Expense } from "@/lib/domain";

interface RouteContext {
  params: Promise<{ expenseId: string }> | { expenseId: string };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { expenseId } = await context.params;
    const { accountId, user } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = expensePatchSchema.parse(await request.json());
    const db = await getDb();
    const expense = await db.collection<Expense>(collections.expenses).findOne({ id: expenseId, accountId });

    if (!expense) {
      return problem("Expense was not found.", 404);
    }

    if (expense.source === "settlement" || expense.settlementId) {
      return problem("Settlement ledger entries cannot be edited directly.", 409);
    }

    if (expense.partyId && await hasSettledPartyExpense(db, { accountId, partyId: expense.partyId, expenseId })) {
      return problem("Settled party expenses cannot be edited.", 409);
    }

    const categoryName = payload.categoryName ?? expense.categoryName;
    const categoryId = payload.categoryId ?? expense.categoryId;
    const signedAmount = Number(expense.original?.amount ?? expense.base?.amount ?? 0);
    const keepExistingFlow = !payload.categoryName && !payload.categoryId;
    const moneyFlowType = payload.moneyFlowType ?? classifyMoneyFlowType(signedAmount, {
      source: expense.source,
      merchant: expense.merchant,
      description: expense.description,
      categoryName,
      notes: expense.notes,
      moneyFlowType: keepExistingFlow ? expense.moneyFlowType : undefined
    });
    const updatedExpense: Expense = {
      ...expense,
      categoryId,
      categoryName,
      moneyFlowType,
      updatedAt: new Date().toISOString()
    };

    await reverseExpenseBudgetImpact(expense);
    await db.collection<Expense>(collections.expenses).updateOne(
      { id: expenseId, accountId },
      {
        $set: {
          categoryId,
          categoryName,
          moneyFlowType,
          updatedAt: updatedExpense.updatedAt
        }
      }
    );
    await applyExpenseBudgetImpact(updatedExpense, user.id);

    return ok({ expense: updatedExpense });
  } catch (error) {
    return handleApiError(error);
  }
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
