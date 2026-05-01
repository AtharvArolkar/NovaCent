import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { handleApiError, ok, problem } from "@/lib/server/http";
import { collections, getDb } from "@/lib/server/mongodb";
import { calculatedBudgetSpent } from "@/lib/server/budgets";
import { budgetSchema } from "@/lib/server/schemas";

interface RouteContext {
  params: Promise<{ budgetId: string }> | { budgetId: string };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { budgetId } = await context.params;
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = budgetSchema.parse(await request.json());
    const db = await getDb();
    const existing = await db.collection(collections.budgets).findOne({ id: budgetId, accountId });

    if (!existing) {
      return problem("Budget was not found.", 404);
    }

    const spent = await calculatedBudgetSpent(db, {
      accountId,
      scope: payload.scope,
      categoryId: payload.categoryId,
      categoryName: payload.categoryName,
      currency: payload.limit.currency,
      period: payload.period
    });
    const updatedBudget = {
      ...existing,
      scope: payload.scope,
      categoryId: payload.categoryId,
      categoryName: payload.categoryName,
      period: payload.period,
      limit: payload.limit,
      alertThreshold: payload.alertThreshold,
      spent,
      updatedAt: new Date().toISOString()
    };

    await db.collection(collections.budgets).updateOne(
      { id: budgetId, accountId },
      {
        $set: {
          categoryId: updatedBudget.categoryId,
          scope: updatedBudget.scope,
          categoryName: updatedBudget.categoryName,
          period: updatedBudget.period,
          limit: updatedBudget.limit,
          alertThreshold: updatedBudget.alertThreshold,
          spent: updatedBudget.spent,
          updatedAt: updatedBudget.updatedAt
        }
      }
    );

    return ok({ budget: updatedBudget });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { budgetId } = await context.params;
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const result = await db.collection(collections.budgets).deleteOne({ id: budgetId, accountId });

    if (!result.deletedCount) {
      return problem("Budget was not found.", 404);
    }

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
