import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { created, handleApiError, ok } from "@/lib/server/http";
import { budgetSchema } from "@/lib/server/schemas";
import { calculatedBudgetSpent, hydrateBudgetSpend } from "@/lib/server/budgets";
import type { Budget } from "@/lib/domain";

export async function GET(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const budgets = await db.collection<Budget>(collections.budgets).find({ accountId }).sort({ categoryName: 1 }).toArray();
    const hydratedBudgets = await hydrateBudgetSpend(db, accountId, budgets);
    return ok({ budgets: hydratedBudgets });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = budgetSchema.parse(await request.json());
    const db = await getDb();
    const spent = await calculatedBudgetSpent(db, {
      accountId,
      scope: payload.scope,
      categoryId: payload.categoryId,
      categoryName: payload.categoryName,
      currency: payload.limit.currency,
      period: payload.period
    });
    const budget = {
      id: crypto.randomUUID(),
      accountId,
      scope: payload.scope,
      categoryId: payload.categoryId,
      categoryName: payload.categoryName,
      period: payload.period,
      limit: payload.limit,
      alertThreshold: payload.alertThreshold,
      spent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.collection(collections.budgets).insertOne(budget);
    return created({ budget });
  } catch (error) {
    return handleApiError(error);
  }
}
