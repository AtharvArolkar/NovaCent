import { accountIdFromRequest, requireAccountAccess } from "@/lib/server/auth";
import { collections, getDb } from "@/lib/server/mongodb";
import { created, handleApiError, ok } from "@/lib/server/http";
import { budgetSchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const db = await getDb();
    const budgets = await db.collection(collections.budgets).find({ accountId }).sort({ categoryName: 1 }).toArray();
    return ok({ budgets });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { accountId } = await requireAccountAccess(accountIdFromRequest(request));
    const payload = budgetSchema.parse(await request.json());
    const db = await getDb();
    const budget = {
      id: crypto.randomUUID(),
      accountId,
      categoryId: payload.categoryId,
      categoryName: payload.categoryName,
      period: "monthly",
      limit: payload.limit,
      alertThreshold: payload.alertThreshold,
      spent: { amount: 0, currency: payload.limit.currency },
      createdAt: new Date().toISOString()
    };
    await db.collection(collections.budgets).insertOne(budget);
    return created({ budget });
  } catch (error) {
    return handleApiError(error);
  }
}

